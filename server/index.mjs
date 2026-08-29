import { createReadStream, mkdirSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createCloudflareAccessVerifier } from "./cloudflare-access.mjs";
import { applyAction, buildClientState, createDefaultState, exportState, normalizeState } from "./domain.mjs";
import { findPublishedUpdate, getLatestUpdate, streamUpdateFile } from "./update-catalog.mjs";

const serverDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(serverDir, "..");
const maxBodyBytes = 2 * 1024 * 1024;
const publicFiles = new Set(["index.html", "config.js", "app.js", "styles.css", "icon.svg", "manifest.webmanifest", "service-worker.js"]);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function sendJson(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      const error = new Error("Corpo da requisição muito grande.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    const error = new Error("JSON inválido.");
    error.statusCode = 400;
    throw error;
  }
}

function requestIdentity(authenticatedUser, requireAccessAuth) {
  if (!requireAccessAuth) return { id: "local", email: "", name: "Usuário local" };

  const subject = String(authenticatedUser?.sub || "").trim();
  const email = String(authenticatedUser?.email || "").trim().toLowerCase();
  if (!subject || subject.length > 512 || !email || email.length > 320) {
    const error = new Error("A conta autenticada não possui uma identidade válida.");
    error.statusCode = 403;
    throw error;
  }

  return {
    id: `access:${subject}`,
    email,
    name: authenticatedUser.name || authenticatedUser.common_name || "",
  };
}

function isSameOriginRequest(request, origin) {
  try {
    const forwardedHost = String(request.headers["x-forwarded-host"] || "").split(",")[0].trim();
    const host = forwardedHost || String(request.headers.host || "").trim();
    const forwardedProtocol = String(request.headers["x-forwarded-proto"] || "").split(",")[0].trim();
    const protocol = forwardedProtocol || (request.socket.encrypted ? "https" : "http");
    return Boolean(host) && new URL(origin).origin === new URL(`${protocol}://${host}`).origin;
  } catch {
    return false;
  }
}

export function createFocusFlowServer(options = {}) {
  const staticRoot = resolve(options.staticRoot || process.env.STATIC_ROOT || projectRoot);
  const dataFile = resolve(options.dataFile || process.env.DATA_FILE || resolve(projectRoot, "data", "focusflow.sqlite"));
  const updatesRoot = resolve(options.updatesRoot || process.env.UPDATES_ROOT || resolve(projectRoot, "updates"));
  const allowedOrigins = new Set(
    (options.allowedOrigins || process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
  const requireAccessAuth = options.requireAccessAuth ?? process.env.REQUIRE_ACCESS_AUTH === "true";
  const legacyOwnerEmail = String(options.legacyOwnerEmail ?? process.env.LEGACY_OWNER_EMAIL ?? "").trim().toLowerCase();
  const verifyAccessToken = requireAccessAuth
    ? options.verifyAccessToken || createCloudflareAccessVerifier({
      teamDomain: options.teamDomain || process.env.TEAM_DOMAIN,
      audience: options.policyAudience || process.env.POLICY_AUD,
    })
    : null;

  mkdirSync(dirname(dataFile), { recursive: true });
  const database = new DatabaseSync(dataFile);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    CREATE TABLE IF NOT EXISTS state_store (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      state_json TEXT,
      revision INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    INSERT OR IGNORE INTO state_store (id, state_json, revision, updated_at)
    VALUES (1, NULL, 0, datetime('now'));
    CREATE TABLE IF NOT EXISTS user_state_store (
      user_id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      state_json TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
  `);

  const readLegacyState = database.prepare("SELECT state_json, revision, updated_at FROM state_store WHERE id = 1");
  const readUserState = database.prepare("SELECT state_json, revision, updated_at FROM user_state_store WHERE user_id = ?");
  const insertUserState = database.prepare(`
    INSERT OR IGNORE INTO user_state_store (user_id, email, state_json, revision, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  const updateUserState = database.prepare(`
    UPDATE user_state_store
    SET email = ?, state_json = ?, revision = revision + 1, updated_at = ?
    WHERE user_id = ?
  `);

  function ensureUserState(identity) {
    let row = readUserState.get(identity.id);
    if (row) return row;

    let initialState = createDefaultState(identity);
    let revision = 1;
    let updatedAt = new Date().toISOString();
    if (legacyOwnerEmail && identity.email === legacyOwnerEmail) {
      const legacy = readLegacyState.get();
      if (legacy?.state_json) {
        try {
          initialState = normalizeState(JSON.parse(legacy.state_json), identity);
          revision = Math.max(1, Number(legacy.revision) || 1);
          updatedAt = legacy.updated_at || updatedAt;
        } catch {
          // Um legado inválido não pode impedir a criação isolada da conta.
        }
      }
    }

    insertUserState.run(identity.id, identity.email, JSON.stringify(initialState), revision, updatedAt);
    row = readUserState.get(identity.id);
    return row;
  }

  const server = createServer(async (request, response) => {
    const origin = request.headers.origin;
    const corsHeaders = {};

    if (origin) {
      if (!allowedOrigins.has(origin) && !isSameOriginRequest(request, origin)) {
        sendJson(response, 403, { error: "Origem não permitida." });
        return;
      }
      corsHeaders["Access-Control-Allow-Origin"] = origin;
      corsHeaders.Vary = "Origin";
    }

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        ...corsHeaders,
        "Access-Control-Allow-Headers": "Authorization, Content-Type, Cf-Access-Jwt-Assertion",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Max-Age": "86400",
      });
      response.end();
      return;
    }

    try {
      const url = new URL(request.url, "http://localhost");

      if (url.pathname === "/api/health" && request.method === "GET") {
        sendJson(response, 200, { status: "ok", database: "ready", timestamp: new Date().toISOString() }, corsHeaders);
        return;
      }

      let authenticatedUser = null;
      if (url.pathname.startsWith("/api/") && requireAccessAuth) {
        const accessToken = request.headers["cf-access-jwt-assertion"];
        if (typeof accessToken !== "string" || !accessToken) {
          sendJson(response, 401, { error: "Autenticação obrigatória." }, corsHeaders);
          return;
        }
        try {
          authenticatedUser = await verifyAccessToken(accessToken);
        } catch {
          sendJson(response, 403, { error: "Sessão inválida ou expirada." }, corsHeaders);
          return;
        }
      }
      const identity = url.pathname.startsWith("/api/")
        ? requestIdentity(authenticatedUser, requireAccessAuth)
        : null;

      if (url.pathname === "/api/auth" && request.method === "GET") {
        sendJson(response, 200, {
          authenticated: Boolean(authenticatedUser),
          user: authenticatedUser
            ? { email: identity.email, subject: authenticatedUser.sub }
            : null,
        }, corsHeaders);
        return;
      }

      if (url.pathname === "/api/desktop-updates/latest" && request.method === "GET") {
        const release = await getLatestUpdate(
          updatesRoot,
          url.searchParams.get("platform"),
          url.searchParams.get("arch"),
          url.searchParams.get("package"),
        );
        sendJson(response, 200, {
          ...release,
          url: `/api/desktop-updates/download/${encodeURIComponent(release.file)}`,
        }, corsHeaders);
        return;
      }

      if (url.pathname.startsWith("/api/desktop-updates/download/") && ["GET", "HEAD"].includes(request.method)) {
        const requestedFile = decodeURIComponent(url.pathname.slice("/api/desktop-updates/download/".length));
        const release = await findPublishedUpdate(updatesRoot, requestedFile);
        await streamUpdateFile(request, response, updatesRoot, release, corsHeaders);
        return;
      }

      if (url.pathname === "/api/state" && request.method === "GET") {
        const row = ensureUserState(identity);
        sendJson(response, 200, {
          state: buildClientState(JSON.parse(row.state_json), identity),
          revision: Number(row.revision),
          updatedAt: row.updated_at,
        }, corsHeaders);
        return;
      }

      if (url.pathname === "/api/action" && request.method === "POST") {
        const body = await readJson(request);
        const current = ensureUserState(identity);
        if (Number.isInteger(body.baseRevision) && body.baseRevision !== Number(current.revision)) {
          sendJson(response, 409, {
            error: "Os dados foram atualizados em outro dispositivo.",
            revision: Number(current.revision),
            updatedAt: current.updated_at,
          }, corsHeaders);
          return;
        }

        const nextState = applyAction(normalizeState(JSON.parse(current.state_json), identity), body.action, body.payload, identity);
        updateUserState.run(identity.email, JSON.stringify(nextState), new Date().toISOString(), identity.id);
        const saved = readUserState.get(identity.id);
        sendJson(response, 200, {
          state: buildClientState(nextState, identity),
          revision: Number(saved.revision),
          updatedAt: saved.updated_at,
        }, corsHeaders);
        return;
      }

      if (url.pathname === "/api/export" && request.method === "GET") {
        const row = ensureUserState(identity);
        const exported = exportState(JSON.parse(row.state_json), url.searchParams.get("format"), identity);
        response.writeHead(200, {
          ...corsHeaders,
          "Content-Type": exported.contentType,
          "Content-Disposition": `attachment; filename="${exported.filename}"`,
          "X-FocusFlow-Filename": exported.filename,
          "Cache-Control": "no-store",
        });
        response.end(exported.content);
        return;
      }

      if (url.pathname.startsWith("/api/")) {
        sendJson(response, 404, { error: "Endpoint não encontrado." }, corsHeaders);
        return;
      }

      if (request.method !== "GET" && request.method !== "HEAD") {
        sendJson(response, 405, { error: "Método não permitido." }, corsHeaders);
        return;
      }

      const pathname = decodeURIComponent(url.pathname);
      let requestedFile = pathname === "/" ? "index.html" : pathname.slice(1);
      if (!publicFiles.has(requestedFile)) {
        if (!request.headers.accept?.includes("text/html")) {
          sendJson(response, 404, { error: "Arquivo não encontrado." }, corsHeaders);
          return;
        }
        requestedFile = "index.html";
      }

      let filePath = resolve(staticRoot, requestedFile);
      if (filePath !== staticRoot && !filePath.startsWith(`${staticRoot}${sep}`)) {
        sendJson(response, 403, { error: "Acesso negado." }, corsHeaders);
        return;
      }

      try {
        if (!(await stat(filePath)).isFile()) throw new Error("Not a file");
      } catch {
        if (!request.headers.accept?.includes("text/html")) {
          sendJson(response, 404, { error: "Arquivo não encontrado." }, corsHeaders);
          return;
        }
        filePath = resolve(staticRoot, "index.html");
      }

      const headers = {
        ...corsHeaders,
        "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
        "Cache-Control": process.env.NODE_ENV === "production" && !filePath.endsWith("service-worker.js")
          ? "public, max-age=300"
          : "no-store",
        "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; manifest-src 'self'",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
      };
      response.writeHead(200, headers);
      if (request.method === "HEAD") response.end();
      else createReadStream(filePath).pipe(response);
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        error: error.statusCode ? error.message : "Erro interno do servidor.",
      }, corsHeaders);
    }
  });

  server.on("close", () => database.close());
  return server;
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMainModule) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || "127.0.0.1";
  const server = createFocusFlowServer();
  server.listen(port, host, () => {
    console.log(`FocusFlow web e API disponíveis em http://${host}:${port}`);
  });
}
