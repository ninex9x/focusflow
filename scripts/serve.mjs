import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const webRoot = resolve(root, "web");
const port = Number(process.env.PORT || 4173);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  let filePath = resolve(webRoot, pathname === "/" ? "index.html" : `.${pathname}`);

  if (filePath !== webRoot && !filePath.startsWith(`${webRoot}${sep}`)) {
    response.writeHead(403).end("Acesso negado");
    return;
  }

  try {
    if (!(await stat(filePath)).isFile()) throw new Error("Not a file");
  } catch {
    filePath = resolve(webRoot, "index.html");
  }

  response.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(filePath).pipe(response);
}).listen(port, "127.0.0.1", () => {
  const address = server.address();
  console.log(`FocusFlow disponível em http://127.0.0.1:${address.port}`);
});

export default server;
