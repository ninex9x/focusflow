import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const updatesDirectory = join(root, "updates");
const dryRun = process.argv.includes("--dry-run");
const argument = (name, fallback) => process.argv.find((value) => value.startsWith(`${name}=`))?.slice(name.length + 1) || fallback;
const host = argument("--host", process.env.FOCUSFLOW_UPDATE_HOST || "");
const remoteDirectory = argument("--remote-dir", process.env.FOCUSFLOW_UPDATE_REMOTE_DIR || "");

if (!/^[A-Za-z0-9._@-]+$/.test(host) || !/^\/[A-Za-z0-9._/-]+$/.test(remoteDirectory) || remoteDirectory.includes("..")) {
  throw new Error("Destino SSH inválido. Defina FOCUSFLOW_UPDATE_HOST e FOCUSFLOW_UPDATE_REMOTE_DIR ou use --host e --remote-dir.");
}

async function sha256(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function run(command, args) {
  if (dryRun) {
    console.log([command, ...args].join(" "));
    return Promise.resolve();
  }
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`${command} terminou com código ${code}.`)));
  });
}

const catalogPath = join(updatesDirectory, "catalog.json");
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
if (catalog.schema !== 1 || !catalog.targets || typeof catalog.targets !== "object") throw new Error("Catálogo inválido.");

const files = [];
for (const release of Object.values(catalog.targets)) {
  const file = String(release.file || "");
  if (!/^[A-Za-z0-9._-]+$/.test(file) || file.includes("..")) throw new Error("Nome de artefato inválido.");
  const filePath = join(updatesDirectory, file);
  const fileStat = await stat(filePath);
  if (fileStat.size !== Number(release.size) || await sha256(filePath) !== String(release.sha256).toLowerCase()) {
    throw new Error(`Integridade local inválida: ${file}`);
  }
  files.push({ file, filePath });
}

await run("ssh", [host, `mkdir -p ${remoteDirectory}`]);
await run("scp", [...files.map(({ filePath }) => filePath), `${host}:${remoteDirectory}/`]);
await run("scp", [catalogPath, `${host}:${remoteDirectory}/catalog.json`]);
await run("ssh", [host, `sha256sum ${files.map(({ file }) => `${remoteDirectory}/${file}`).join(" ")}`]);
console.log(dryRun
  ? `Simulação concluída para ${host}; nenhum arquivo foi enviado.`
  : `Atualização ${catalog.channel || "stable"} publicada em ${host}.`);
