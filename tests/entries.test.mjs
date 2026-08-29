import assert from "node:assert/strict";
import test from "node:test";
import { applyAction, buildClientState, createDefaultState, localDateKey } from "../server/domain.mjs";

const identity = { sub: "entry-user", email: "registros@example.com", name: "Pessoa" };

function createProject() {
  return applyAction(createDefaultState(identity), "project-save", {
    name: "Projeto",
    client: "Cliente",
    status: "active",
    estimate: 100,
    dueDate: "",
    color: "#a5c8ff",
  }, identity);
}

function createEntry(state, minutes, date = localDateKey(), title = "Trabalho") {
  return applyAction(state, "entry-create", {
    projectId: state.projects[0].id,
    title,
    minutes,
    date,
  }, identity);
}

test("a soma dos lançamentos nunca pode ultrapassar as 24 horas de uma data", () => {
  let state = createProject();
  state = createEntry(state, 23 * 60);
  assert.throws(() => createEntry(state, 61), /Um dia não pode ultrapassar 24h.*Restam 1h/);

  state = createEntry(state, 60);
  assert.equal(buildClientState(state, identity).summary.todayMinutes, 24 * 60);
  assert.throws(() => createEntry(state, 1), /Restam 0min/);
  assert.throws(() => createEntry(state, 30, "2026-02-30"), /Data inválida/);
});

test("um lançamento pode ser corrigido, movido de data e excluído", () => {
  let state = createEntry(createProject(), 120, localDateKey(), "Descrição errada");
  const entryId = state.entries[0].id;
  const originalProjectId = state.entries[0].projectId;
  state = applyAction(state, "project-save", {
    name: "Outro projeto",
    client: "",
    status: "active",
    estimate: 10,
    dueDate: "",
    color: "#3b82f6",
  }, identity);
  const yesterday = localDateKey(1);

  state = applyAction(state, "entry-update", {
    id: entryId,
    projectId: state.projects[1].id,
    title: "Descrição corrigida",
    minutes: 45,
    date: yesterday,
  }, identity);

  assert.equal(state.entries[0].title, "Descrição corrigida");
  assert.equal(state.entries[0].projectId, originalProjectId);
  assert.equal(state.entries[0].minutes, 45);
  assert.equal(state.entries[0].date, yesterday);
  assert.equal(buildClientState(state, identity).summary.todayMinutes, 0);

  state = applyAction(state, "entry-delete", { id: entryId }, identity);
  assert.deepEqual(state.entries, []);
});

test("início e fim são persistidos com o horário de Brasília", () => {
  let state = createProject();
  state = applyAction(state, "entry-create", {
    projectId: state.projects[0].id,
    title: "Reunião de planejamento",
    startedAt: "2026-08-17T09:15",
    endedAt: "2026-08-17T10:45",
    minutes: 90,
  }, identity);

  assert.equal(state.entries[0].date, "2026-08-17");
  assert.equal(state.entries[0].startedAt, "2026-08-17T09:15:00-03:00");
  assert.equal(state.entries[0].endedAt, "2026-08-17T10:45:00-03:00");
  assert.equal(state.entries[0].timeZone, "America/Sao_Paulo");
  assert.equal(state.entries[0].minutes, 90);
});

test("a correção valida período, pausas e horários sobrepostos", () => {
  let state = createProject();
  state = applyAction(state, "entry-create", {
    projectId: state.projects[0].id,
    title: "Primeiro bloco",
    startedAt: "2026-08-17T09:00",
    endedAt: "2026-08-17T11:00",
    minutes: 105,
  }, identity);

  assert.throws(() => applyAction(state, "entry-create", {
    projectId: state.projects[0].id,
    title: "Bloco sobreposto",
    startedAt: "2026-08-17T10:30",
    endedAt: "2026-08-17T12:00",
    minutes: 90,
  }, identity), /sobrepõe a outro lançamento/);

  assert.throws(() => applyAction(state, "entry-update", {
    id: state.entries[0].id,
    projectId: state.projects[0].id,
    title: "Período invertido",
    startedAt: "2026-08-17T11:00",
    endedAt: "2026-08-17T10:00",
    minutes: 60,
  }, identity), /fim deve ser posterior/);

  assert.throws(() => applyAction(state, "entry-update", {
    id: state.entries[0].id,
    projectId: state.projects[0].id,
    title: "Duração impossível",
    startedAt: "2026-08-17T09:00",
    endedAt: "2026-08-17T10:00",
    minutes: 90,
  }, identity), /duração trabalhada não pode ser maior/);

  state = applyAction(state, "entry-update", {
    id: state.entries[0].id,
    projectId: state.projects[0].id,
    title: "Primeiro bloco corrigido",
    startedAt: "2026-08-17T08:30",
    endedAt: "2026-08-17T10:00",
    minutes: 75,
  }, identity);
  assert.equal(state.entries[0].startedAt, "2026-08-17T08:30:00-03:00");
  assert.equal(state.entries[0].endedAt, "2026-08-17T10:00:00-03:00");
  assert.equal(state.entries[0].minutes, 75);
});

test("registros legados acima de 24h são sinalizados e podem ser reparados", () => {
  let state = createProject();
  state.entries.push({
    id: "entry-forgotten",
    projectId: state.projects[0].id,
    title: "Cronômetro esquecido",
    minutes: 48 * 60,
    date: localDateKey(),
    source: "timer",
  });

  let clientState = buildClientState(state, identity);
  assert.equal(clientState.summary.rawTodayMinutes, 48 * 60);
  assert.equal(clientState.summary.todayMinutes, 24 * 60);
  assert.equal(clientState.analytics[7].values.at(-1), 24 * 60);
  assert.equal(clientState.analytics[7].topProject.minutes, 24 * 60);
  assert.deepEqual(clientState.analytics[7].overLimitDays, [{
    date: localDateKey(),
    totalMinutes: 48 * 60,
    excessMinutes: 24 * 60,
  }]);

  state = applyAction(state, "entry-update", {
    id: "entry-forgotten",
    projectId: state.projects[0].id,
    title: "Trabalho corrigido",
    minutes: 90,
    date: localDateKey(),
  }, identity);
  clientState = buildClientState(state, identity);
  assert.equal(clientState.summary.todayMinutes, 90);
  assert.deepEqual(clientState.analytics[7].overLimitDays, []);
});

test("um cronômetro esquecido exige revisão antes de registrar", () => {
  let state = createProject();
  state.timer = {
    projectId: state.projects[0].id,
    subtaskId: null,
    elapsedSeconds: 48 * 60 * 60,
    startedAt: null,
    running: false,
  };

  assert.throws(() => applyAction(state, "timer-stop", {}, identity), /sessão não pode ultrapassar 24h/);
  state = applyAction(state, "timer-stop", {
    title: "Tempo realmente trabalhado",
    minutes: 75,
    date: localDateKey(),
  }, identity);

  assert.equal(state.entries[0].minutes, 75);
  assert.equal(state.entries[0].title, "Tempo realmente trabalhado");
  assert.equal(state.timer.elapsedSeconds, 0);
});
