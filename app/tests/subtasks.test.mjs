import assert from "node:assert/strict";
import test from "node:test";
import { applyAction, buildClientState, createDefaultState } from "../server/domain.mjs";

const identity = { sub: "subtask-user", email: "subtarefas@example.com", name: "Pessoa" };

function createProject(estimate = 2) {
  return applyAction(createDefaultState(identity), "project-save", {
    name: "Projeto com etapas",
    client: "Cliente",
    status: "active",
    estimate,
    dueDate: "",
    color: "#a5c8ff",
  }, identity);
}

function saveSubtask(state, payload) {
  return applyAction(state, "subtask-save", {
    projectId: state.projects[0].id,
    ...payload,
  }, identity);
}

test("subtarefas respeitam o orçamento do projeto e podem ser editadas e concluídas", () => {
  let state = createProject();
  const projectId = state.projects[0].id;

  state = saveSubtask(state, { title: "Pesquisa", estimate: 0.5 });
  state = saveSubtask(state, { title: "Implementação", estimate: 1 });
  const [research, implementation] = state.projects[0].subtasks;

  assert.equal(research.estimateMinutes, 30);
  assert.equal(implementation.estimateMinutes, 60);
  assert.throws(() => saveSubtask(state, { title: "Excesso", estimate: 1 }), /Restam 30min/);
  assert.throws(() => applyAction(state, "project-save", {
    id: projectId,
    name: "Projeto com etapas",
    client: "Cliente",
    status: "active",
    estimate: 1,
    dueDate: "",
    color: "#a5c8ff",
  }, identity), /1h 30min distribuídas/);

  state = saveSubtask(state, { id: research.id, title: "Descoberta", estimate: 0.25 });
  state = applyAction(state, "subtask-set-completed", {
    projectId,
    id: research.id,
    completed: true,
  }, identity);

  assert.equal(state.projects[0].subtasks[0].title, "Descoberta");
  assert.equal(state.projects[0].subtasks[0].estimateMinutes, 15);
  assert.equal(state.projects[0].subtasks[0].completed, true);
});

test("o cronômetro registra tempo na subtarefa selecionada e protege a etapa em uso", () => {
  let state = createProject(1);
  const projectId = state.projects[0].id;
  state = saveSubtask(state, { title: "Execução", estimate: 0.5 });
  const subtaskId = state.projects[0].subtasks[0].id;

  state = applyAction(state, "timer-project", { id: projectId, subtaskId }, identity);
  state = applyAction(state, "timer-toggle", {}, identity);
  assert.throws(() => applyAction(state, "timer-project", { id: projectId, subtaskId: null }, identity), /Pause o cronômetro/);
  assert.throws(() => applyAction(state, "subtask-delete", { projectId, id: subtaskId }, identity), /Finalize o cronômetro/);

  state = applyAction(state, "timer-toggle", {}, identity);
  state.timer.elapsedSeconds = 30 * 60;
  state = applyAction(state, "timer-stop", {}, identity);

  assert.equal(state.entries.at(-1).subtaskId, subtaskId);
  assert.equal(state.entries.at(-1).subtaskTitle, "Execução");
  const clientState = buildClientState(state, identity);
  assert.equal(clientState.projects[0].subtasks[0].loggedMinutes, 30);
  assert.equal(clientState.projects[0].subtasks[0].actualPercentage, 100);

  state = applyAction(state, "subtask-delete", { projectId, id: subtaskId }, identity);
  assert.equal(state.projects[0].subtasks.length, 0);
  assert.equal(state.timer.subtaskId, null);
});
