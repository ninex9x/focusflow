import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = resolve(root, "web");
const dist = resolve(root, "dist");
const webAssets = [
  "index.html",
  "config.js",
  "app.js",
  "styles.css",
  "icon.svg",
  "manifest.webmanifest",
  "service-worker.js",
];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const asset of webAssets) {
  await cp(resolve(webRoot, asset), resolve(dist, asset));
}

console.log(`FocusFlow web pronto em ${dist}`);
