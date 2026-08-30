import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createFocusFlowServer } from "../server/index.mjs";

test("a API executa regras no backend, persiste e protege contra comandos antigos", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "focusflow-api-"));
  const origin = "https://focusflow.example.com";
  const server = createFocusFlowServer({ dataFile: join(temporaryDirectory, "test.sqlite"), allowedOrigins: origin });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    const initial = await fetch(`${baseUrl}/api/state`);
    assert.equal(initial.status, 200);
    const initialPayload = await initial.json();
    assert.equal(initialPayload.revision, 1);
    assert.equal(initialPayload.state.projects.length, 0);
    assert.equal(typeof initialPayload.state.summary.todayMinutes, "number");
    assert.equal(typeof initialPayload.state.analytics[7].total, "number");

    const saved = await fetch(`${baseUrl}/api/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ action: "goal-save", payload: { hours: 7.5 }, baseRevision: 1 }),
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.headers.get("access-control-allow-origin"), origin);
    const savedPayload = await saved.json();
    assert.equal(savedPayload.revision, 2);
    assert.equal(savedPayload.state.settings.dailyGoalMinutes, 450);

    const loaded = await fetch(`${baseUrl}/api/state`);
    const loadedPayload = await loaded.json();
    assert.equal(loadedPayload.revision, 2);
    assert.equal(loadedPayload.state.settings.dailyGoalMinutes, 450);

    const stale = await fetch(`${baseUrl}/api/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ action: "reset", baseRevision: 1 }),
    });
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).revision, 2);

    const exported = await fetch(`${baseUrl}/api/export?format=csv`);
    assert.equal(exported.status, 200);
    assert.match(exported.headers.get("content-disposition"), /focusflow-registros/);
    assert.match(await exported.text(), /Data,|"Data"/);

    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, "ok");

    const privateFile = await fetch(`${baseUrl}/data/test.sqlite`);
    assert.equal(privateFile.status, 404);

    const forbiddenOrigin = await fetch(`${baseUrl}/api/state`, {
      headers: { Origin: "https://example.com" },
    });
    assert.equal(forbiddenOrigin.status, 403);
  } finally {
    server.close();
    await once(server, "close");
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("o modo local aceita a própria origem sem configuração de CORS", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "focusflow-local-origin-"));
  const server = createFocusFlowServer({ dataFile: join(temporaryDirectory, "test.sqlite") });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const response = await fetch(`${baseUrl}/api/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: baseUrl },
      body: JSON.stringify({ action: "goal-save", payload: { hours: 6 }, baseRevision: 1 }),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), baseUrl);
    assert.equal((await response.json()).state.settings.dailyGoalMinutes, 360);
  } finally {
    server.close();
    await once(server, "close");
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("a API grava início e fim de Brasília no banco SQLite", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "focusflow-entry-times-"));
  const dataFile = join(temporaryDirectory, "test.sqlite");
  const server = createFocusFlowServer({ dataFile });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const projectResponse = await fetch(`${baseUrl}/api/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "project-save",
        baseRevision: 1,
        payload: { name: "Projeto", client: "", status: "active", estimate: 10, dueDate: "", color: "#3b82f6" },
      }),
    });
    assert.equal(projectResponse.status, 200);
    const projectPayload = await projectResponse.json();
    const projectId = projectPayload.state.projects[0].id;

    const entryResponse = await fetch(`${baseUrl}/api/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "entry-create",
        baseRevision: 2,
        payload: {
          projectId,
          title: "Implementação",
          startedAt: "2026-08-17T13:00",
          endedAt: "2026-08-17T14:20",
          minutes: 80,
        },
      }),
    });
    assert.equal(entryResponse.status, 200);
    const entryPayload = await entryResponse.json();
    assert.equal(entryPayload.state.entries[0].startedAt, "2026-08-17T13:00:00-03:00");

    const database = new DatabaseSync(dataFile, { readOnly: true });
    const row = database.prepare("SELECT state_json FROM user_state_store WHERE user_id = 'local'").get();
    database.close();
    const storedEntry = JSON.parse(row.state_json).entries[0];
    assert.deepEqual({
      startedAt: storedEntry.startedAt,
      endedAt: storedEntry.endedAt,
      timeZone: storedEntry.timeZone,
      minutes: storedEntry.minutes,
    }, {
      startedAt: "2026-08-17T13:00:00-03:00",
      endedAt: "2026-08-17T14:20:00-03:00",
      timeZone: "America/Sao_Paulo",
      minutes: 80,
    });
  } finally {
    server.close();
    await once(server, "close");
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("a API exige e valida o JWT do Access quando a proteção está ativa", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "focusflow-auth-"));
  const verifiedTokens = [];
  const server = createFocusFlowServer({
    dataFile: join(temporaryDirectory, "test.sqlite"),
    requireAccessAuth: true,
    verifyAccessToken: async (token) => {
      verifiedTokens.push(token);
      if (token !== "valid-token") throw new Error("invalid");
      return { sub: "google-user", email: "usuario@example.com" };
    },
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);
    const protectedPage = await fetch(`${baseUrl}/`);
    assert.equal(protectedPage.status, 200);
    assert.match(await protectedPage.text(), /<title>FocusFlow<\/title>/);
    assert.equal((await fetch(`${baseUrl}/api/state`)).status, 401);
    assert.equal((await fetch(`${baseUrl}/api/state`, {
      headers: { "Cf-Access-Jwt-Assertion": "invalid-token" },
    })).status, 403);

    const authorized = await fetch(`${baseUrl}/api/auth`, {
      headers: { "Cf-Access-Jwt-Assertion": "valid-token" },
    });
    assert.equal(authorized.status, 200);
    assert.deepEqual(await authorized.json(), {
      authenticated: true,
      user: { email: "usuario@example.com", subject: "google-user" },
    });
    assert.deepEqual(verifiedTokens, ["invalid-token", "valid-token"]);
  } finally {
    server.close();
    await once(server, "close");
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("cada identidade autenticada possui perfil, revisão e dados isolados", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "focusflow-users-"));
  const users = {
    "alice-token": { sub: "google-alice", email: "alice@example.com", name: "Alice" },
    "bob-token": { sub: "google-bob", email: "bob@example.com", name: "Bob" },
  };
  const server = createFocusFlowServer({
    dataFile: join(temporaryDirectory, "test.sqlite"),
    requireAccessAuth: true,
    verifyAccessToken: async (token) => {
      if (!users[token]) throw new Error("invalid");
      return users[token];
    },
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const headers = (token) => ({ "Cf-Access-Jwt-Assertion": token, "Content-Type": "application/json" });

  try {
    const aliceInitial = await (await fetch(`${baseUrl}/api/state`, { headers: headers("alice-token") })).json();
    assert.equal(aliceInitial.revision, 1);
    assert.equal(aliceInitial.state.profile.email, "alice@example.com");
    assert.equal(aliceInitial.state.profile.name, "Alice");
    assert.deepEqual(aliceInitial.state.projects, []);

    const aliceSaved = await fetch(`${baseUrl}/api/action`, {
      method: "POST",
      headers: headers("alice-token"),
      body: JSON.stringify({
        action: "profile-save",
        baseRevision: 1,
        payload: { name: "Alice Silva", email: "bob@example.com", workspace: "Alice Workspace" },
      }),
    });
    assert.equal(aliceSaved.status, 200);
    const aliceSavedPayload = await aliceSaved.json();
    assert.equal(aliceSavedPayload.revision, 2);
    assert.equal(aliceSavedPayload.state.profile.email, "alice@example.com");
    assert.equal(aliceSavedPayload.state.profile.workspace, "Alice Workspace");

    const bobInitial = await (await fetch(`${baseUrl}/api/state`, { headers: headers("bob-token") })).json();
    assert.equal(bobInitial.revision, 1);
    assert.equal(bobInitial.state.profile.email, "bob@example.com");
    assert.equal(bobInitial.state.profile.name, "Bob");
    assert.equal(bobInitial.state.profile.workspace, "Meu Workspace");

    const aliceReloaded = await (await fetch(`${baseUrl}/api/state`, { headers: headers("alice-token") })).json();
    assert.equal(aliceReloaded.revision, 2);
    assert.equal(aliceReloaded.state.profile.workspace, "Alice Workspace");
  } finally {
    server.close();
    await once(server, "close");
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("o estado legado é migrado somente para o e-mail proprietário", async () => {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "focusflow-legacy-"));
  const dataFile = join(temporaryDirectory, "test.sqlite");
  const database = new DatabaseSync(dataFile);
  database.exec(`
    CREATE TABLE state_store (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      state_json TEXT,
      revision INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);
  const legacyState = {
    profile: { name: "Alex Morgan", email: "alex.morgan@designstudio.com", workspace: "Design Studio", plan: "Pro Plan" },
    settings: { dailyGoalMinutes: 480 },
    projects: [{ id: "legacy-project", name: "Privado", client: "", status: "active", estimateMinutes: 60, color: "#a5c8ff", archived: false, createdAt: "2026-08-13" }],
    entries: [],
    timer: { projectId: "legacy-project", elapsedSeconds: 0, startedAt: null, running: false },
    meta: { version: 2 },
  };
  database.prepare("INSERT INTO state_store (id, state_json, revision, updated_at) VALUES (1, ?, 7, ?)")
    .run(JSON.stringify(legacyState), "2026-08-13T12:00:00.000Z");
  database.close();

  const users = {
    owner: { sub: "google-owner", email: "owner@example.com", name: "Owner" },
    stranger: { sub: "google-stranger", email: "outra@example.com" },
  };
  const server = createFocusFlowServer({
    dataFile,
    legacyOwnerEmail: "owner@example.com",
    requireAccessAuth: true,
    verifyAccessToken: async (token) => users[token],
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  const stateFor = async (token) => (await fetch(`${baseUrl}/api/state`, {
    headers: { "Cf-Access-Jwt-Assertion": token },
  })).json();

  try {
    const stranger = await stateFor("stranger");
    assert.equal(stranger.revision, 1);
    assert.deepEqual(stranger.state.projects, []);
    assert.equal(stranger.state.profile.email, "outra@example.com");

    const owner = await stateFor("owner");
    assert.equal(owner.revision, 7);
    assert.equal(owner.state.projects[0].id, "legacy-project");
    assert.equal(owner.state.settings.dailyGoalMinutes, 480);
    assert.equal(owner.state.profile.email, "owner@example.com");
    assert.equal(owner.state.profile.name, "Owner");
    assert.equal(owner.state.profile.workspace, "Meu Workspace");
  } finally {
    server.close();
    await once(server, "close");
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("a demonstração usa dados fictícios, temporários e isolados por navegador", async () => {
  const server = createFocusFlowServer({ demoMode: true });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const firstResponse = await fetch(`${baseUrl}/api/state`);
    const firstCookie = firstResponse.headers.get("set-cookie").split(";")[0];
    const first = await firstResponse.json();
    assert.equal(first.demoMode, true);
    assert.equal(first.state.profile.email, "demo@focusflow.local");
    assert.ok(first.state.projects.length >= 3);
    assert.ok(first.state.entries.length >= 8);

    const changedResponse = await fetch(`${baseUrl}/api/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: firstCookie },
      body: JSON.stringify({ action: "goal-save", payload: { hours: 8 }, baseRevision: first.revision }),
    });
    const changed = await changedResponse.json();
    assert.equal(changed.state.settings.dailyGoalMinutes, 480);

    const secondResponse = await fetch(`${baseUrl}/api/state`);
    const second = await secondResponse.json();
    assert.equal(second.state.settings.dailyGoalMinutes, 360);
    assert.notEqual(secondResponse.headers.get("set-cookie").split(";")[0], firstCookie);

    const resetResponse = await fetch(`${baseUrl}/api/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: firstCookie },
      body: JSON.stringify({ action: "reset", baseRevision: changed.revision }),
    });
    const reset = await resetResponse.json();
    assert.equal(reset.state.settings.dailyGoalMinutes, 360);
    assert.ok(reset.state.projects.some((project) => project.name === "Website institucional"));
  } finally {
    server.close();
    await once(server, "close");
  }
});
