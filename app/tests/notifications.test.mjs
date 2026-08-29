import assert from "node:assert/strict";
import test from "node:test";
import { applyAction, buildClientState, createDefaultState, localDateKey } from "../server/domain.mjs";

const identity = { sub: "notification-user", email: "usuario@example.com", name: "Usuário" };
const offsetToday = (days) => {
  const date = new Date(`${localDateKey()}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

function createProject(state, overrides = {}) {
  return applyAction(state, "project-save", {
    name: "Projeto importante",
    client: "Cliente",
    status: "active",
    estimate: 1,
    dueDate: "",
    color: "#a5c8ff",
    ...overrides,
  }, identity);
}

function addEntry(state, minutes, date = localDateKey()) {
  return applyAction(state, "entry-create", {
    projectId: state.projects[0].id,
    title: "Sessão de foco",
    minutes,
    date,
  }, identity);
}

test("o backend avisa em 80% e novamente quando a estimativa é ultrapassada", () => {
  let state = createProject(createDefaultState(identity));
  state = addEntry(state, 48);

  let clientState = buildClientState(state, identity);
  let estimate = clientState.notifications.items.find((item) => item.type === "estimate");
  assert.equal(estimate?.id.endsWith(":80"), true);
  assert.equal(estimate?.target, "project");
  assert.match(estimate?.message || "", /80%/);

  state = applyAction(state, "notifications-read", { ids: [estimate.id, "notificacao-inexistente"] }, identity);
  assert.equal(buildClientState(state, identity).notifications.unreadCount, 0);

  state = addEntry(state, 13);
  clientState = buildClientState(state, identity);
  estimate = clientState.notifications.items.find((item) => item.type === "estimate");
  assert.equal(estimate?.id.endsWith(":100"), true);
  assert.equal(estimate?.read, false);
  assert.match(estimate?.message || "", /102%/);
});

test("o backend gera alertas de cronômetro esquecido e prazo", () => {
  let state = createProject(createDefaultState(identity), { dueDate: offsetToday(1) });
  state.timer = {
    projectId: state.projects[0].id,
    elapsedSeconds: 0,
    startedAt: Date.now() - 4 * 60 * 60 * 1000 - 5 * 60 * 1000,
    running: true,
  };

  let clientState = buildClientState(state, identity);
  const timer = clientState.notifications.items.find((item) => item.type === "timer");
  const deadline = clientState.notifications.items.find((item) => item.type === "deadline");
  assert.match(timer?.message || "", /4h 5min/);
  assert.equal(timer?.target, "home");
  assert.equal(deadline?.title, "Prazo vence amanhã");
  assert.equal(deadline?.target, "project");

  state = createProject(state, { id: state.projects[0].id, dueDate: offsetToday(-2) });
  clientState = buildClientState(state, identity);
  assert.match(clientState.notifications.items.find((item) => item.type === "deadline")?.message || "", /atrasado há 2 dias/);

  assert.throws(() => createProject(state, { id: state.projects[0].id, dueDate: "2026-02-30" }), /Prazo inválido/);
});

test("o backend gera meta concluída, risco manual e resumo da semana anterior", () => {
  let state = createProject(createDefaultState(identity), { status: "risk" });
  state = applyAction(state, "goal-save", { hours: 1 }, identity);
  state = addEntry(state, 60);
  state = addEntry(state, 90, localDateKey(7));

  const clientState = buildClientState(state, identity);
  const goal = clientState.notifications.items.find((item) => item.type === "goal");
  const weekly = clientState.notifications.items.find((item) => item.type === "weekly");
  assert.equal(goal?.title, "Meta diária concluída");
  assert.equal(goal?.target, "home");
  assert.match(weekly?.message || "", /1h 30min em 1 sessão/);
  assert.equal(weekly?.target, "stats");
  assert.equal(clientState.notifications.items.some((item) => item.type === "estimate"), true);

  let riskOnlyState = createProject(createDefaultState(identity), { status: "risk" });
  const risk = buildClientState(riskOnlyState, identity).notifications.items.find((item) => item.type === "risk");
  assert.match(risk?.message || "", /marcado como risco/);
});

test("as preferências filtram cada categoria e o bloqueio geral", () => {
  let state = createProject(createDefaultState(identity), { status: "risk", dueDate: offsetToday(0) });
  state.timer = { projectId: state.projects[0].id, elapsedSeconds: 14_500, startedAt: Date.now(), running: true };
  state = applyAction(state, "notifications-save", {
    notifications: true,
    timerAlerts: false,
    goalReminders: false,
    riskAlerts: false,
    deadlineAlerts: false,
    weeklySummary: false,
  }, identity);
  assert.deepEqual(buildClientState(state, identity).notifications, { enabled: true, items: [], unreadCount: 0 });

  state = applyAction(state, "notifications-save", { notifications: false }, identity);
  assert.deepEqual(buildClientState(state, identity).notifications, { enabled: false, items: [], unreadCount: 0 });
});

test("a migração normaliza prazos, subtarefas e identificadores já lidos", () => {
  const legacyState = createProject(createDefaultState(identity));
  legacyState.projects[0].dueDate = "data-inválida";
  legacyState.projects[0].subtasks = [
    { id: "etapa", title: " Pesquisa ", estimateMinutes: 29.6, completed: 1, createdAt: "data-inválida" },
    { id: "etapa", title: "Entrega", estimateMinutes: "30", completed: false, createdAt: localDateKey() },
    { id: "inválido!", title: " Legado ", estimateMinutes: -5 },
    { id: "ignorada", title: "   ", estimateMinutes: 15 },
  ];
  legacyState.timer = {
    ...legacyState.timer,
    projectId: legacyState.projects[0].id,
    subtaskId: "inexistente",
  };
  legacyState.meta = {
    version: 4,
    readNotificationIds: ["risk:project-1", "risk:project-1", "inválido!"],
  };

  const state = buildClientState(legacyState, identity);
  assert.equal(state.meta.version, 8);
  assert.equal(state.projects[0].dueDate, "");
  assert.deepEqual(state.projects[0].subtasks.map((subtask) => subtask.id), ["etapa", "etapa-1", "subtask-legacy-2"]);
  assert.equal(state.projects[0].subtasks[0].title, "Pesquisa");
  assert.equal(state.projects[0].subtasks[0].estimateMinutes, 30);
  assert.equal(state.projects[0].subtasks[0].completed, true);
  assert.equal(state.projects[0].subtasks[2].estimateMinutes, 0);
  assert.equal(state.timer.subtaskId, null);
  assert.deepEqual(state.meta.readNotificationIds, ["risk:project-1"]);
});
