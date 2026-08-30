import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
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

const [html, domainSource, demoStateSource, demoApiSource, appSource] = await Promise.all([
  readFile(resolve(webRoot, "index.html"), "utf8"),
  readFile(resolve(appRoot, "server", "domain.mjs"), "utf8"),
  readFile(resolve(appRoot, "server", "demo-state.mjs"), "utf8"),
  readFile(resolve(appRoot, "demo", "demo-api.js"), "utf8"),
  readFile(resolve(webRoot, "app.js"), "utf8"),
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
  serviceWorkerEnabled: false,
});
`;
const demoRuntime = `${demoConfig}\n${demoDomain}\n${demoState}\n${demoApiSource}`;
const demoBundle = `${demoRuntime}\n/* FocusFlow UI */\n${appSource}`;
const bundleHash = createHash("sha256").update(demoBundle).digest("hex").slice(0, 12);
const bundleName = `demo-app-${bundleHash}.js`;
const loadingMarkup = `<div id="app"><main class="demo-boot" aria-live="polite"><div><img src="icon.svg" alt="" /><strong>FocusFlow</strong><span>Carregando demonstração...</span></div></main></div>`;
const bootScript = `<script>
      (() => {
        const retryKey = "focusflow-demo-boot-v22";
        const retryOnce = () => {
          try {
            if (sessionStorage.getItem(retryKey)) return false;
            sessionStorage.setItem(retryKey, "1");
          } catch {}
          const next = new URL(location.href);
          next.searchParams.set("boot", Date.now());
          location.replace(next.href);
          return true;
        };
        if ("serviceWorker" in navigator) {
          navigator.serviceWorker.getRegistrations()
            .then((items) => Promise.all(items.map((item) => item.unregister())))
            .then(() => { if (navigator.serviceWorker.controller) retryOnce(); })
            .catch(() => {});
        }
        window.addEventListener("error", (event) => {
          if (event.filename && event.filename.includes("${bundleName}")) retryOnce();
        });
        setTimeout(() => {
          if (document.documentElement.dataset.focusFlowReady === "true" || retryOnce()) return;
          document.querySelector("#app").innerHTML = '<main class="demo-boot"><div><strong>FocusFlow</strong><span>Não foi possível iniciar a demonstração.</span><button type="button" onclick="location.reload()">Tentar novamente</button></div></main>';
        }, 8_000);
      })();
    </script>`;
const demoHtml = html
  .replace('<div id="app"></div>', loadingMarkup)
  .replace(/\s*<script defer src="config\.js"><\/script>\s*<script defer src="app\.js"><\/script>/, `\n    ${bootScript}\n    <script defer src="${bundleName}"></script>`);
const retiringServiceWorker = `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(self.registration.unregister().then(() => self.clients.matchAll()).then((clients) => Promise.all(clients.map((client) => client.navigate(client.url)))));
});
`;

await Promise.all([
  writeFile(resolve(dist, "index.html"), demoHtml),
  writeFile(resolve(dist, "config.js"), demoConfig),
  writeFile(resolve(dist, "demo-domain.js"), demoDomain),
  writeFile(resolve(dist, "demo-state.js"), demoState),
  writeFile(resolve(dist, "service-worker.js"), retiringServiceWorker),
  writeFile(resolve(dist, bundleName), demoBundle),
  writeFile(resolve(dist, ".nojekyll"), ""),
]);

console.log(`Demonstração estática pronta em ${dist}`);
