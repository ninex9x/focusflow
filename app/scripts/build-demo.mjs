import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webRoot = resolve(appRoot, "web");
const dist = resolve(appRoot, "dist");
const webAssets = ["styles.css", "app.js", "icon.svg", "manifest.webmanifest"];

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const asset of webAssets) await cp(resolve(webRoot, asset), resolve(dist, asset));
await cp(resolve(appRoot, "demo", "demo-api.js"), resolve(dist, "demo-api.js"));

const [html, domainSource, demoStateSource, serviceWorker] = await Promise.all([
  readFile(resolve(webRoot, "index.html"), "utf8"),
  readFile(resolve(appRoot, "server", "domain.mjs"), "utf8"),
  readFile(resolve(appRoot, "server", "demo-state.mjs"), "utf8"),
  readFile(resolve(webRoot, "service-worker.js"), "utf8"),
]);

const demoDomain = `(() => {\n${domainSource.replace(/^export /gm, "")}\n` +
  "globalThis.FocusFlowDomain = Object.freeze({ DomainError, localDateKey, createDefaultState, normalizeState, buildClientState, applyAction, exportState });\n})();\n";
const demoState = `(() => {\nconst { createDefaultState, localDateKey } = globalThis.FocusFlowDomain;\n` +
  `${demoStateSource.replace(/^import .*$/m, "").replace(/^export /gm, "")}\n` +
  "globalThis.createFocusFlowDemoState = createDemoState;\n})();\n";
const demoConfig = `globalThis.FocusFlowConfig = Object.freeze({
  apiBaseUrl: "",
  requestTimeoutMs: 7_000,
  appVersion: "1.4.4",
  demoMode: true,
});
`;
const demoHtml = html.replace(
  '<script defer src="app.js"></script>',
  '<script defer src="demo-domain.js"></script>\n    <script defer src="demo-state.js"></script>\n    <script defer src="demo-api.js"></script>\n    <script defer src="app.js"></script>',
);
const demoServiceWorker = serviceWorker
  .replace('const CACHE = "focusflow-v19";', 'const CACHE = "focusflow-demo-v21";')
  .replace('"./app.js"', '"./demo-domain.js", "./demo-state.js", "./demo-api.js", "./app.js"');

await Promise.all([
  writeFile(resolve(dist, "index.html"), demoHtml),
  writeFile(resolve(dist, "config.js"), demoConfig),
  writeFile(resolve(dist, "demo-domain.js"), demoDomain),
  writeFile(resolve(dist, "demo-state.js"), demoState),
  writeFile(resolve(dist, "service-worker.js"), demoServiceWorker),
  writeFile(resolve(dist, ".nojekyll"), ""),
]);

console.log(`Demonstração estática pronta em ${dist}`);
