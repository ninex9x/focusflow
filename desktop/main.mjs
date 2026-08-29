import { createReadStream } from "node:fs";
import { randomBytes } from "node:crypto";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, safeStorage, shell } from "electron";
import { AuthenticationRequiredError, ManagedOAuthClient } from "./oauth.mjs";
import { SecureTokenStore } from "./secure-token-store.mjs";
import { DesktopUpdater } from "./updater.mjs";

const desktopDirectory = dirname(fileURLToPath(import.meta.url));
const applicationRoot = resolve(desktopDirectory, "..");
const publicFiles = new Set(["index.html", "app.js", "styles.css", "icon.svg", "manifest.webmanifest"]);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

let mainWindow;
let localServer;
const nativeUpdateToken = randomBytes(32).toString("base64url");

const oauthTokenStore = new SecureTokenStore({
  filePath: () => join(app.getPath("userData"), "oauth-session.bin"),
  isEncryptionAvailable: () => safeStorage.isEncryptionAvailable()
    && (process.platform !== "linux" || safeStorage.getSelectedStorageBackend() !== "basic_text"),
  encryptString: (value) => safeStorage.encryptString(value),
  decryptString: (value) => safeStorage.decryptString(value),
});

const oauth = new ManagedOAuthClient({
  resource: "https://flow.sosaiko.com",
  openExternal: (url) => shell.openExternal(url),
  tokenStore: oauthTokenStore,
});
const desktopUpdater = new DesktopUpdater({ app, oauth, shell });

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

async function proxyApi(request, response, url) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);

  try {
    const upstream = await oauth.authorizedFetch(`${url.pathname}${url.search}`, {
      method: request.method,
      headers: request.headers["content-type"] ? { "Content-Type": request.headers["content-type"] } : {},
      body: ["GET", "HEAD"].includes(request.method) ? undefined : Buffer.concat(chunks),
    }, { interactive: false });
    const headers = {};
    for (const name of ["content-type", "content-disposition", "x-focusflow-filename", "cache-control"]) {
      const value = upstream.headers.get(name);
      if (value) headers[name] = value;
    }
    response.writeHead(upstream.status, headers);
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    sendJson(response, error instanceof AuthenticationRequiredError ? 401 : 503, {
      error: error.message || "Não foi possível autenticar.",
    });
  }
}

async function handleNativeAuth(request, response, url) {
  if (request.headers["x-focusflow-native-token"] !== nativeUpdateToken) {
    sendJson(response, 403, { error: "Autorização local inválida." });
    return;
  }
  if (url.pathname === "/native/auth/status" && request.method === "GET") {
    sendJson(response, 200, { authenticated: await oauth.hasSession() });
    return;
  }
  if (url.pathname === "/native/auth/login" && request.method === "POST") {
    try {
      await oauth.getAccessToken({ interactive: true });
      sendJson(response, 200, { authenticated: true });
    } catch (error) {
      sendJson(response, 503, { authenticated: false, error: error.message || "O login não foi concluído." });
    }
    return;
  }
  sendJson(response, 404, { error: "Operação de autenticação não encontrada." });
}

async function handleNativeUpdates(request, response, url) {
  if (request.headers["x-focusflow-native-token"] !== nativeUpdateToken) {
    sendJson(response, 403, { error: "Autorização local inválida." });
    return;
  }
  if (url.pathname === "/native/updates/status" && request.method === "GET") {
    sendJson(response, 200, desktopUpdater.getStatus());
    return;
  }
  if (url.pathname === "/native/updates/check" && request.method === "POST") {
    sendJson(response, 200, await desktopUpdater.check());
    return;
  }
  if (url.pathname === "/native/updates/install" && request.method === "POST") {
    sendJson(response, 200, await desktopUpdater.install());
    return;
  }
  sendJson(response, 404, { error: "Operação local não encontrada." });
}

async function serveStatic(request, response, url) {
  let requestedFile = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  if (requestedFile === "config.js") {
    response.writeHead(200, {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "no-store",
      "Cross-Origin-Resource-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
    });
    response.end(`globalThis.FocusFlowConfig=Object.freeze(${JSON.stringify({
      apiBaseUrl: "",
      requestTimeoutMs: 300000,
      nativeShell: "desktop",
      nativeUpdateToken,
      appVersion: app.getVersion(),
    })});`);
    return;
  }
  if (!publicFiles.has(requestedFile)) requestedFile = "index.html";
  const filePath = resolve(applicationRoot, requestedFile);
  if (!filePath.startsWith(`${applicationRoot}${sep}`) || !(await stat(filePath)).isFile()) {
    sendJson(response, 404, { error: "Arquivo não encontrado." });
    return;
  }
  response.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; manifest-src 'self'",
    "Cross-Origin-Resource-Policy": "same-origin",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  });
  if (request.method === "HEAD") response.end();
  else createReadStream(filePath).pipe(response);
}

async function startLocalServer() {
  localServer = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      const expectedHost = `127.0.0.1:${localServer.address().port}`;
      if (request.headers.host !== expectedHost || request.headers["sec-fetch-site"] === "cross-site") {
        sendJson(response, 403, { error: "Origem local inválida." });
        return;
      }
      if (url.pathname.startsWith("/native/auth/")) await handleNativeAuth(request, response, url);
      else if (url.pathname.startsWith("/native/updates/")) await handleNativeUpdates(request, response, url);
      else if (url.pathname.startsWith("/api/")) await proxyApi(request, response, url);
      else if (["GET", "HEAD"].includes(request.method)) await serveStatic(request, response, url);
      else sendJson(response, 405, { error: "Método não permitido." });
    } catch {
      sendJson(response, 500, { error: "Erro interno do cliente desktop." });
    }
  });
  await new Promise((resolvePromise, reject) => {
    localServer.once("error", reject);
    localServer.listen(0, "127.0.0.1", resolvePromise);
  });
  return localServer.address().port;
}

async function createWindow() {
  const port = await startLocalServer();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: "#050505",
    title: "FocusFlow",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== `http://127.0.0.1:${port}`) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
  await mainWindow.loadURL(`http://127.0.0.1:${port}/`);
  desktopUpdater.start();
}

async function runSelfTest() {
  try {
    const port = await startLocalServer();
    const [page, config, crossSiteConfig] = await Promise.all([
      fetch(`http://127.0.0.1:${port}/`),
      fetch(`http://127.0.0.1:${port}/config.js`),
      fetch(`http://127.0.0.1:${port}/config.js`, { headers: { "Sec-Fetch-Site": "cross-site" } }),
    ]);
    const pageText = await page.text();
    const configText = await config.text();
    if (!page.ok || !config.ok || crossSiteConfig.status !== 403 || !pageText.includes("<title>FocusFlow</title>") || !configText.includes('"nativeShell":"desktop"') || !configText.includes('"nativeUpdateToken"')) {
      throw new Error("Os recursos empacotados não foram carregados.");
    }
    localServer.close(() => app.exit(0));
  } catch {
    localServer?.close();
    app.exit(1);
  }
}

app.whenReady().then(() => process.argv.includes("--self-test") ? runSelfTest() : createWindow());
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  desktopUpdater.stop();
  localServer?.close();
});
