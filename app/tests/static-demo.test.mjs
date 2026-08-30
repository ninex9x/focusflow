import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

test("a demo estática funciona sem backend e mantém os dados na sessão", async () => {
  await import(`../scripts/build-demo.mjs?test=${Date.now()}`);

  const readDist = (name) => readFile(new URL(`../dist/${name}`, import.meta.url), "utf8");
  const [config, domain, demoState, demoApi, app, html, serviceWorker] = await Promise.all([
    readDist("config.js"),
    readDist("demo-domain.js"),
    readDist("demo-state.js"),
    readDist("demo-api.js"),
    readDist("app.js"),
    readDist("index.html"),
    readDist("service-worker.js"),
  ]);

  assert.match(html, /demo-domain\.js[\s\S]*demo-state\.js[\s\S]*demo-api\.js[\s\S]*app\.js/);
  assert.match(serviceWorker, /demo-api\.js/);
  assert.match(domain, /^\(\(\) => \{/);
  assert.match(demoState, /^\(\(\) => \{/);

  // Todos os scripts devem compilar juntos sem colisões no escopo global.
  assert.doesNotThrow(() => new vm.Script(`${config}\n${domain}\n${demoState}\n${demoApi}\n${app}`));

  const session = new Map();
  const context = vm.createContext({
    console,
    Date,
    Intl,
    JSON,
    Map,
    Math,
    Object,
    Request,
    Response,
    Set,
    String,
    URL,
    structuredClone,
    location: { href: "https://ninex9x.github.io/focusflow/", origin: "https://ninex9x.github.io" },
    sessionStorage: {
      getItem: (key) => session.get(key) ?? null,
      setItem: (key, value) => session.set(key, value),
    },
    fetch: async () => { throw new Error("A demo tentou acessar a rede."); },
  });

  for (const source of [config, domain, demoState, demoApi]) vm.runInContext(source, context);

  const initialResponse = await context.fetch("/api/state");
  const initial = await initialResponse.json();
  assert.equal(initial.demoMode, true);
  assert.ok(initial.state.projects.length >= 3);
  assert.equal(initial.state.profile.email, "demo@focusflow.local");

  const savedResponse = await context.fetch("/api/action", {
    method: "POST",
    body: JSON.stringify({ action: "goal-save", payload: { hours: 8 }, baseRevision: initial.revision }),
  });
  const saved = await savedResponse.json();
  assert.equal(savedResponse.status, 200);
  assert.equal(saved.state.settings.dailyGoalMinutes, 480);
  assert.ok(session.has("focusflow-static-demo-v1"));
});
