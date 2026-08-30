import { createDefaultState, localDateKey } from "./domain.mjs";

function dateFromToday(offset) {
  return localDateKey(-offset);
}

export function createDemoState(identity = {}) {
  const state = createDefaultState(identity);
  state.profile.workspace = "Portfólio FocusFlow";
  state.settings.dailyGoalMinutes = 360;

  state.projects = [
    {
      id: "demo-project-website",
      name: "Website institucional",
      client: "Cliente fictício · Aurora",
      status: "ontrack",
      estimateMinutes: 2_400,
      dueDate: dateFromToday(12),
      color: "#f59e0b",
      archived: false,
      createdAt: dateFromToday(-28),
      subtasks: [
        { id: "demo-subtask-research", title: "Pesquisa e arquitetura", estimateMinutes: 600, completed: true, createdAt: dateFromToday(-28) },
        { id: "demo-subtask-ui", title: "Interface responsiva", estimateMinutes: 1_080, completed: false, createdAt: dateFromToday(-21) },
        { id: "demo-subtask-handoff", title: "Revisão e entrega", estimateMinutes: 720, completed: false, createdAt: dateFromToday(-7) },
      ],
    },
    {
      id: "demo-project-mobile",
      name: "Aplicativo mobile",
      client: "Cliente fictício · Órbita",
      status: "risk",
      estimateMinutes: 1_800,
      dueDate: dateFromToday(3),
      color: "#60a5fa",
      archived: false,
      createdAt: dateFromToday(-24),
      subtasks: [
        { id: "demo-subtask-flow", title: "Fluxo principal", estimateMinutes: 720, completed: true, createdAt: dateFromToday(-24) },
        { id: "demo-subtask-prototype", title: "Protótipo navegável", estimateMinutes: 1_080, completed: false, createdAt: dateFromToday(-16) },
      ],
    },
    {
      id: "demo-project-dashboard",
      name: "Dashboard de métricas",
      client: "Projeto demonstrativo",
      status: "completed",
      estimateMinutes: 1_200,
      dueDate: dateFromToday(-5),
      color: "#34d399",
      archived: false,
      createdAt: dateFromToday(-35),
      subtasks: [
        { id: "demo-subtask-data", title: "Modelo de dados", estimateMinutes: 480, completed: true, createdAt: dateFromToday(-35) },
        { id: "demo-subtask-charts", title: "Visualização e filtros", estimateMinutes: 720, completed: true, createdAt: dateFromToday(-29) },
      ],
    },
  ];

  state.entries = [
    ["demo-entry-01", "demo-project-website", "demo-subtask-ui", "Sistema de componentes", 135, 0],
    ["demo-entry-02", "demo-project-mobile", "demo-subtask-prototype", "Ajustes no protótipo", 105, 0],
    ["demo-entry-03", "demo-project-website", "demo-subtask-ui", "Layout responsivo", 180, 1],
    ["demo-entry-04", "demo-project-mobile", "demo-subtask-flow", "Validação do fluxo", 150, 2],
    ["demo-entry-05", "demo-project-website", "demo-subtask-research", "Mapa de conteúdo", 120, 3],
    ["demo-entry-06", "demo-project-dashboard", "demo-subtask-charts", "Gráficos de produtividade", 210, 4],
    ["demo-entry-07", "demo-project-mobile", "demo-subtask-prototype", "Estados da interface", 165, 5],
    ["demo-entry-08", "demo-project-dashboard", "demo-subtask-data", "Estrutura das métricas", 150, 6],
    ["demo-entry-09", "demo-project-website", "demo-subtask-ui", "Revisão visual", 90, 8],
    ["demo-entry-10", "demo-project-dashboard", "demo-subtask-charts", "Filtros do relatório", 195, 10],
    ["demo-entry-11", "demo-project-mobile", "demo-subtask-flow", "Jornada de entrada", 120, 12],
  ].map(([id, projectId, subtaskId, title, minutes, daysAgo]) => ({
    id,
    projectId,
    subtaskId,
    title,
    minutes,
    date: localDateKey(daysAgo),
    source: "manual",
  }));

  state.timer.projectId = "demo-project-website";
  state.timer.subtaskId = "demo-subtask-ui";
  return state;
}
