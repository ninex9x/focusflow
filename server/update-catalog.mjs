import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { basename, extname, resolve, sep } from "node:path";

const TARGETS = new Set(["win32-x64-nsis", "linux-x64-appimage", "linux-x64-deb"]);
const CONTENT_TYPES = {
  ".exe": "application/vnd.microsoft.portable-executable",
  ".appimage": "application/octet-stream",
  ".deb": "application/vnd.debian.binary-package",
};

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function assertRelease(value, target) {
  if (!value || typeof value !== "object") throw httpError(404, "Atualização não publicada para este sistema.");
  const file = String(value.file || "");
  const version = String(value.version || "");
  const sha256 = String(value.sha256 || "").toLowerCase();
  const size = Number(value.size);
  if (basename(file) !== file || !/^[A-Za-z0-9._-]+$/.test(file)) throw httpError(500, `Arquivo inválido no catálogo (${target}).`);
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) throw httpError(500, `Versão inválida no catálogo (${target}).`);
  if (!/^[a-f0-9]{64}$/.test(sha256) || !Number.isSafeInteger(size) || size < 1) throw httpError(500, `Integridade inválida no catálogo (${target}).`);
  return {
    version,
    file,
    sha256,
    size,
    mandatory: value.mandatory === true,
    notes: String(value.notes || ""),
    publishedAt: String(value.publishedAt || ""),
  };
}

export function targetKey(platform, arch, packageType) {
  const key = `${platform}-${arch}-${packageType}`.toLowerCase();
  if (!TARGETS.has(key)) throw httpError(400, "Plataforma de atualização não suportada.");
  return key;
}

export async function readUpdateCatalog(updatesRoot) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(resolve(updatesRoot, "catalog.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") throw httpError(404, "Nenhuma atualização foi publicada.");
    if (error instanceof SyntaxError) throw httpError(500, "Catálogo de atualizações inválido.");
    throw error;
  }
  if (parsed?.schema !== 1 || !parsed.targets || typeof parsed.targets !== "object") {
    throw httpError(500, "Catálogo de atualizações incompatível.");
  }
  return parsed;
}

export async function getLatestUpdate(updatesRoot, platform, arch, packageType) {
  const key = targetKey(platform, arch, packageType);
  const catalog = await readUpdateCatalog(updatesRoot);
  const release = assertRelease(catalog.targets[key], key);
  const filePath = resolve(updatesRoot, release.file);
  if (!filePath.startsWith(`${resolve(updatesRoot)}${sep}`)) throw httpError(500, "Caminho de atualização inválido.");
  const fileStat = await stat(filePath).catch((error) => {
    if (error.code === "ENOENT") throw httpError(404, "Pacote de atualização indisponível.");
    throw error;
  });
  if (!fileStat.isFile() || fileStat.size !== release.size) throw httpError(503, "Pacote publicado está incompleto.");
  return { ...release, target: key };
}

export async function findPublishedUpdate(updatesRoot, requestedFile) {
  const file = String(requestedFile || "");
  if (!file || basename(file) !== file || !/^[A-Za-z0-9._-]+$/.test(file)) throw httpError(404, "Pacote não encontrado.");
  const catalog = await readUpdateCatalog(updatesRoot);
  for (const [target, value] of Object.entries(catalog.targets)) {
    if (!TARGETS.has(target)) continue;
    const release = assertRelease(value, target);
    if (release.file === file) return { ...release, target };
  }
  throw httpError(404, "Pacote não encontrado.");
}

export async function streamUpdateFile(request, response, updatesRoot, release, extraHeaders = {}) {
  const filePath = resolve(updatesRoot, release.file);
  const fileStat = await stat(filePath).catch((error) => {
    if (error.code === "ENOENT") throw httpError(404, "Pacote não encontrado.");
    throw error;
  });
  if (!fileStat.isFile() || fileStat.size !== release.size) throw httpError(503, "Pacote publicado está incompleto.");

  let start = 0;
  let end = fileStat.size - 1;
  let status = 200;
  const range = request.headers.range;
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (!match) throw httpError(416, "Intervalo de download inválido.");
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : end;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end >= fileStat.size) {
      throw httpError(416, "Intervalo de download inválido.");
    }
    status = 206;
  }

  response.writeHead(status, {
    ...extraHeaders,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Type": CONTENT_TYPES[extname(release.file).toLowerCase()] || "application/octet-stream",
    "Content-Disposition": `attachment; filename="${release.file}"`,
    "Content-Length": String(end - start + 1),
    "X-Content-Type-Options": "nosniff",
    ...(status === 206 ? { "Content-Range": `bytes ${start}-${end}/${fileStat.size}` } : {}),
  });
  if (request.method === "HEAD") response.end();
  else createReadStream(filePath, { start, end }).pipe(response);
}
