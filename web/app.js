const ROUTES = ["home", "projects", "stats", "settings"];
const API_BASE_URL = String(globalThis.FocusFlowConfig?.apiBaseUrl || "").replace(/\/$/, "");
const SYNC_INTERVAL_MS = 30_000;
const MAX_DAILY_MINUTES = 24 * 60;
const CLIENT_PLATFORM = globalThis.FocusFlowAndroid?.request
  ? "Android"
  : globalThis.FocusFlowConfig?.nativeShell === "desktop" ? "Desktop" : "Web/PWA";
const IS_NATIVE_CLIENT = CLIENT_PLATFORM !== "Web/PWA";
const APP_VERSION = String(globalThis.FocusFlowConfig?.appVersion || "1.4.4");
const APP_TIME_ZONE = "America/Sao_Paulo";
const NATIVE_UPDATE_TOKEN = String(globalThis.FocusFlowConfig?.nativeUpdateToken || "");

const icons = {
  home: '<path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  projects: '<path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  stats: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 17v-4m4 4V7m4 10v-7"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1z"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  pause: '<path d="M8 5v14m8-14v14"/>',
  play: '<path d="m8 5 11 7-11 7z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  trend: '<path d="m3 17 6-6 4 4 8-9m-5 0h5v5"/>',
  more: '<circle cx="12" cy="5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
  archive: '<path d="M4 7h16v13H4zM3 3h18v4H3zm6 8h6"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6m5 4v7m4-7v7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M5 20h14"/>',
  moon: '<path d="M20 15.5A9 9 0 1 1 8.5 4 7 7 0 0 0 20 15.5z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
  logout: '<path d="M10 17l5-5-5-5m5 5H3m10-9h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  spark: '<path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6zM5 16l.8 2.2L8 19l-2.2.8L5 22l-.8-2.2L2 19l2.2-.8zM19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  flag: '<path d="M5 21V4m0 1h11l-2 4 2 4H5"/>',
  alert: '<path d="M12 3 2.8 20h18.4zM12 9v4m0 3h.01"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8m-8 4h8"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
};

function icon(name, className = "icon") {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.spark}</svg>`;
}

function localDateKey(daysAgo = 0) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() - daysAgo * 86_400_000));
}

let state = {
  profile: { name: "", email: "", workspace: "", plan: "" },
  settings: { notifications: false, timerAlerts: false, goalReminders: false, riskAlerts: false, deadlineAlerts: false, weeklySummary: false, dailyGoalMinutes: 360 },
  projects: [],
  entries: [],
  timer: { projectId: null, subtaskId: null, elapsedSeconds: 0, startedAt: null, sessionStartedAt: null, running: false },
  summary: { todayMinutes: 0, dailyGoalMinutes: 360, progress: 0, timerSeconds: 0, recentEntries: [] },
  notifications: { enabled: false, items: [], unreadCount: 0 },
  analytics: {},
};
let ui = { route: getRoute(), modal: null, menuId: null, notificationsOpen: false, projectFilter: "all", projectSearch: "", chartRange: 7 };
let remoteRevision = null;
let pendingRemoteState = null;
let hydrationPromise = null;
let hasHydratedState = false;
let syncStatus = "connecting";
let desktopUpdateStatus = NATIVE_UPDATE_TOKEN
  ? { status: "idle", currentVersion: APP_VERSION, progress: 0, message: "Atualizações automáticas ativadas." }
  : null;
let updateReadyNoticeVersion = null;
let nativeAuthentication = IS_NATIVE_CLIENT
  ? { status: "checking", message: "Verificando sua sessão segura..." }
  : { status: "authenticated", message: "" };

function getRoute() {
  const route = location.hash.replace("#", "").split("?")[0];
  return ROUTES.includes(route) ? route : "home";
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function projectById(id) { return state.projects.find((project) => project.id === id); }
function entryById(id) { return state.entries.find((entry) => entry.id === id); }
function projectMinutes(id) { return Number(projectById(id)?.loggedMinutes || 0); }
function currentTimerSeconds() { return state.timer.elapsedSeconds + (state.timer.running && state.timer.startedAt ? Math.max(0, Math.floor((Date.now() - state.timer.startedAt) / 1000)) : 0); }
function todayMinutes() { return Math.min(MAX_DAILY_MINUTES, Number(state.summary?.todayMinutes || 0) + Math.max(0, Math.floor((currentTimerSeconds() - Number(state.summary?.timerSeconds || 0)) / 60))); }

function formatTimer(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((part) => String(part).padStart(2, "0")).join(":");
}

function formatDuration(minutes, compact = false) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (compact) return hours ? `${hours}h${mins ? ` ${mins}m` : ""}` : `${mins}m`;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
}

function statusMeta(status) {
  return ({ active: ["Ativo", ""], ontrack: ["No prazo", "success"], risk: ["Em risco", "danger"], completed: ["Concluído", "success"] })[status] || ["Planejado", "warning"];
}

function navItems() {
  return [
    ["home", "home", "Início"], ["projects", "projects", "Projetos"], ["stats", "stats", "Estatísticas"], ["settings", "settings", "Configurações"],
  ];
}

function navMarkup(type = "side") {
  return navItems().map(([route, iconName, label]) => `<a href="#${route}" class="${type === "bottom" ? "bottom-link" : "nav-link"}${ui.route === route ? " active" : ""}" aria-current="${ui.route === route ? "page" : "false"}">${icon(iconName)}<span>${label}</span></a>`).join("");
}

function avatarMarkup(size = "") {
  const initials = state.profile.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return `<div class="avatar ${size}" aria-hidden="true">${escapeHtml(initials)}</div>`;
}

function brazilDateTimeLocal(value = Date.now()) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const fields = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}`;
}

function addMinutesToLocalDateTime(value, minutes) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return value;
  const [, year, month, day, hour, minute] = match;
  const shifted = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)) + Number(minutes || 0) * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function entryTimeDefaults(entry = null) {
  if (entry?.startedAt && entry?.endedAt) {
    return { startedAt: brazilDateTimeLocal(entry.startedAt), endedAt: brazilDateTimeLocal(entry.endedAt), legacy: false };
  }
  if (entry) {
    const minutes = Math.max(1, Number(entry.minutes || 0));
    const startedAt = `${entry.date || localDateKey()}T${minutes >= 900 ? "00:00" : "09:00"}`;
    const endedAt = minutes >= 1440 ? `${entry.date || localDateKey()}T23:59` : addMinutesToLocalDateTime(startedAt, minutes);
    return { startedAt, endedAt, legacy: true };
  }
  const endedAt = brazilDateTimeLocal();
  return { startedAt: addMinutesToLocalDateTime(endedAt, -30), endedAt, legacy: false };
}

function formatEntryTimeRange(entry) {
  if (!entry.startedAt || !entry.endedAt) return `${formatEntryDate(entry.date)} · horário não informado`;
  const formatter = new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${formatEntryDate(entry.date)} · ${formatter.format(new Date(entry.startedAt))}–${formatter.format(new Date(entry.endedAt))} · Brasília`;
}

function syncStatusMarkup() {
  const labels = { connecting: "Conectando", syncing: "Processando", cached: "Atualização pendente", synced: "Online", offline: "Servidor offline" };
  return `<span class="sync-badge ${syncStatus}" data-sync-status><span></span>${labels[syncStatus]}</span>`;
}

function renderNativeLogin() {
  const busy = ["checking", "authenticating"].includes(nativeAuthentication.status);
  const buttonLabel = nativeAuthentication.status === "authenticating"
    ? "Continue no navegador..."
    : nativeAuthentication.status === "checking" ? "Verificando sessão..." : "Entrar com Google";
  const statusClass = nativeAuthentication.status === "error" ? " error" : "";
  return `
    <main class="auth-shell">
      <section class="auth-card" aria-labelledby="auth-title">
        <div class="auth-brand"><img src="icon.svg" alt="" /><span>FocusFlow</span></div>
        <p class="auth-eyebrow mono">FOCO EM TODOS OS SEUS DISPOSITIVOS</p>
        <h1 id="auth-title">Seu tempo, sincronizado.</h1>
        <p class="auth-copy">Entre para acessar seus projetos, registros e estatísticas com segurança no ${escapeHtml(CLIENT_PLATFORM)}.</p>
        <div class="auth-features" aria-label="Recursos da conta">
          <span>${icon("lock", "icon-sm")} Sessão protegida</span>
          <span>${icon("check", "icon-sm")} Dados sempre sincronizados</span>
        </div>
        <button class="btn btn-primary btn-block auth-button" data-action="native-login" ${busy ? "disabled" : ""}>
          ${busy ? '<span class="auth-spinner" aria-hidden="true"></span>' : icon("user")}
          <span>${buttonLabel}</span>
        </button>
        <p class="auth-status${statusClass}" role="status">${escapeHtml(nativeAuthentication.message)}</p>
        <p class="auth-version mono">${escapeHtml(CLIENT_PLATFORM)} · versão ${escapeHtml(APP_VERSION)}</p>
      </section>
    </main>`;
}

function renderDataLoading() {
  const failed = syncStatus === "offline";
  return `<main class="auth-shell data-loading-shell">
    <section class="auth-card data-loading-card" aria-live="polite" aria-busy="${!failed}">
      <div class="auth-brand"><img src="icon.svg" alt=""/><span>FocusFlow</span></div>
      <div class="data-loading-spinner ${failed ? "failed" : ""}">${failed ? icon("alert") : ""}</div>
      <p class="auth-eyebrow mono">${failed ? "CONEXÃO INTERROMPIDA" : "SINCRONIZANDO WORKSPACE"}</p>
      <h1>${failed ? "Não foi possível carregar." : "Carregando seus dados..."}</h1>
      <p class="auth-copy">${failed ? "Confira a conexão e tente novamente. Nenhum dado vazio será exibido no lugar do seu workspace." : "Aguarde enquanto buscamos projetos, subtarefas e registros."}</p>
      ${failed ? `<button class="btn btn-primary btn-block auth-button" data-action="retry-hydration">${icon("trend")}Tentar novamente</button>` : `<div class="data-loading-skeleton" aria-hidden="true"><span></span><span></span><span></span></div>`}
      <p class="auth-version mono">${escapeHtml(CLIENT_PLATFORM)} · versão ${escapeHtml(APP_VERSION)}</p>
    </section>
  </main>`;
}

function render() {
  const app = document.querySelector("#app");
  if (IS_NATIVE_CLIENT && nativeAuthentication.status !== "authenticated") {
    app.innerHTML = renderNativeLogin();
    document.querySelector("#modal-root").innerHTML = "";
    return;
  }
  if (!hasHydratedState) {
    app.innerHTML = renderDataLoading();
    document.querySelector("#modal-root").innerHTML = "";
    return;
  }
  const unreadNotifications = Math.max(0, Number(state.notifications?.unreadCount || 0));
  app.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <button class="topbar-account" type="button" data-action="edit-profile" title="Editar perfil">
          ${avatarMarkup()}
          <span class="topbar-account-copy"><strong>${escapeHtml(state.profile.email || state.profile.name)}</strong><small>Conta Google</small></span>
          ${icon("chevron", "icon-sm")}
        </button>
        <div class="topbar-context">
          <a class="brand" href="#home"><img class="brand-mark" src="icon.svg" alt="" /><span>FocusFlow</span></a>
        </div>
        <div class="topbar-actions">
          <button class="topbar-link" type="button" data-action="about">${icon("info", "icon-sm")}<span>Ajuda</span></button>
          ${syncStatusMarkup()}
          <button class="icon-button notification-button" data-action="notifications" aria-label="${unreadNotifications ? `${unreadNotifications} notificação${unreadNotifications === 1 ? "" : "es"} não lida${unreadNotifications === 1 ? "" : "s"}` : "Abrir notificações"}" aria-expanded="${ui.notificationsOpen}">${icon("bell")}${unreadNotifications ? `<span class="notification-dot" aria-hidden="true">${unreadNotifications > 9 ? "9+" : unreadNotifications}</span>` : ""}</button>
          <button class="topbar-profile" type="button" data-action="edit-profile" aria-label="Editar perfil">${avatarMarkup()}</button>
        </div>
      </header>
      <aside class="sidebar" aria-label="Navegação principal">
        <div class="sidebar-context">
          <span>Workspace</span>
          <strong>${escapeHtml(state.profile.workspace)}</strong>
          <small>${escapeHtml(state.profile.name)}</small>
        </div>
        <p class="nav-section-label">Gerenciar</p>
        <nav class="nav-list">${navMarkup()}</nav>
        <div class="sidebar-footer"><span>FocusFlow ${escapeHtml(APP_VERSION)}</span><span class="sidebar-footer-status"><i></i>Protegido pelo Google</span></div>
      </aside>
      <main class="app-main" id="main-content">${renderPage()}</main>
      <nav class="bottom-nav" aria-label="Navegação principal">${navMarkup("bottom")}</nav>
      ${ui.notificationsOpen ? notificationPanel() : ""}
    </div>`;
  renderModal();
  updateTimerDisplay();
  syncAndroidNotificationState();
}

function renderPage() {
  return ({ home: renderHome, projects: renderProjects, stats: renderStats, settings: renderSettings })[ui.route]();
}

function renderHome() {
  const timerProject = projectById(state.timer.projectId) || state.projects.find((project) => !project.archived);
  const timerSubtask = timerProject?.subtasks?.find((subtask) => subtask.id === state.timer.subtaskId);
  const elapsed = currentTimerSeconds();
  const today = todayMinutes();
  const goal = Math.max(1, state.settings.dailyGoalMinutes);
  const progress = Math.min(100, Math.round((today / goal) * 100));
  const recent = state.summary?.recentEntries || [];
  const correctionWarning = state.summary?.isTodayOverLimit
    ? `<button class="data-warning data-warning-button" type="button" data-action="go-stats">${icon("alert")}<div><strong>Existem mais de 24h registradas hoje</strong><p>O total foi limitado a 24h. Abra o histórico para corrigir o lançamento que ficou ligado por engano.</p></div>${icon("chevron", "icon-sm")}</button>`
    : "";
  return `<div class="page">
    <div class="page-header"><div><p class="eyebrow">${new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date())}</p><h1 class="page-title">Seu espaço de foco</h1><p class="page-subtitle">Um passo de cada vez. O resto pode esperar.</p></div></div>
    <div class="dashboard-grid">
      <section class="card timer-card ${state.timer.running ? "running" : ""}" aria-label="Cronômetro">
        <button class="timer-project" data-action="choose-timer-project">${icon("projects", "icon-sm")}<span class="timer-project-copy"><strong>${escapeHtml(timerProject?.name || "Escolha um projeto")}</strong><small>${timerSubtask ? escapeHtml(timerSubtask.title) : timerProject ? "Projeto inteiro" : "Projeto e subtarefa"}</small></span>${icon("chevron", "icon-sm")}</button>
        <div class="timer-display" data-timer-display>${formatTimer(elapsed)}</div>
        <div class="timer-controls">
          <button class="btn" data-action="toggle-timer">${icon(state.timer.running ? "pause" : "play")}<span>${state.timer.running ? "Pausar" : elapsed ? "Retomar" : "Iniciar"}</span></button>
          <button class="btn btn-primary" data-action="stop-timer" ${elapsed < 1 ? "disabled" : ""}>${icon("stop")}<span>Finalizar</span></button>
        </div>
        <div class="timer-progress"><span data-timer-progress style="--progress:${progress}%"></span></div>
      </section>
      <div class="summary-grid">
        <article class="card summary-card summary-card-large"><div class="metric-label">${icon("clock")}Total de hoje</div><p class="metric-value" data-today-total>${formatDuration(today, true)}</p><p class="metric-trend ${progress >= 70 ? "positive" : ""}">${icon("trend", "icon-sm")} ${progress}% da meta de ${formatDuration(goal, true)}</p></article>
      </div>
      <div class="quick-actions">
        <button class="btn card action-card" data-action="manual-entry">${icon("plus")}<span>Lançamento manual</span></button>
        <button class="btn card action-card" data-action="daily-goal">${icon("target")}<span>Definir meta</span></button>
      </div>
    </div>
    ${correctionWarning}
    <div class="section-heading"><h2 class="section-title">Atividade recente</h2><button class="section-link" data-action="go-stats">Ver estatísticas</button></div>
    <section class="card activity-list">${recent.length ? recent.map(activityRow).join("") : emptyState("clock", "Nenhum registro ainda", "Inicie o cronômetro ou crie um lançamento manual.")}</section>
  </div>`;
}

function activityRow(entry) {
  const target = entry.subtaskTitle ? `${entry.projectName || "Projeto removido"} › ${entry.subtaskTitle}` : (entry.projectName || "Projeto removido");
  return `<div class="activity-row" style="--row-color:${entry.projectColor || "var(--primary)"}"><span class="activity-dot"></span><div><div class="activity-name">${escapeHtml(entry.title || entry.projectName || "Sessão de foco")}</div><div class="activity-meta mono">${escapeHtml(target)} · ${escapeHtml(formatEntryTimeRange(entry))}</div></div><div class="activity-row-side"><time class="activity-time">${formatDuration(entry.minutes)}</time><div class="activity-actions"><button class="icon-button" type="button" data-action="edit-entry" data-id="${escapeHtml(entry.id)}" aria-label="Corrigir ${escapeHtml(entry.title || "lançamento")}">${icon("edit", "icon-sm")}</button><button class="icon-button activity-delete" type="button" data-action="delete-entry" data-id="${escapeHtml(entry.id)}" aria-label="Excluir ${escapeHtml(entry.title || "lançamento")}">${icon("trash", "icon-sm")}</button></div></div></div>`;
}

function sortedEntries() {
  return [...state.entries].sort((first, second) => String(second.startedAt || second.date).localeCompare(String(first.startedAt || first.date)) || second.id.localeCompare(first.id));
}

function formatEntryDate(key) {
  if (key === localDateKey()) return "Hoje";
  if (key === localDateKey(1)) return "Ontem";
  const [year, month, day] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(year, month - 1, day));
}

function emptyState(iconName, title, text) {
  return `<div class="empty-state">${icon(iconName)}<strong>${escapeHtml(title)}</strong><div>${escapeHtml(text)}</div></div>`;
}

function renderProjects() {
  const query = ui.projectSearch.trim().toLocaleLowerCase("pt-BR");
  const projects = state.projects.filter((project) => {
    const matchesArchive = ui.projectFilter === "archived" ? project.archived : !project.archived;
    const matchesStatus = ["all", "archived"].includes(ui.projectFilter) || project.status === ui.projectFilter;
    const matchesQuery = !query || `${project.name} ${project.client}`.toLocaleLowerCase("pt-BR").includes(query);
    return matchesArchive && matchesStatus && matchesQuery;
  });
  return `<div class="page">
    <div class="page-header"><div><p class="eyebrow">Workspace · ${escapeHtml(state.profile.workspace)}</p><h1 class="page-title">Meus Projetos</h1><p class="page-subtitle">Acompanhe as horas e mantenha cada entrega no rumo certo.</p></div><button class="btn btn-primary" data-action="add-project">${icon("plus")}<span>Novo projeto</span></button></div>
    <div class="toolbar">
      <div class="search-box">${icon("search")}<input class="input" id="project-search" type="search" placeholder="Buscar projeto ou cliente" value="${escapeHtml(ui.projectSearch)}" aria-label="Buscar projetos" /></div>
      <select class="select" id="project-filter" aria-label="Filtrar projetos">
        ${[["all","Todos"],["active","Ativos"],["ontrack","No prazo"],["risk","Em risco"],["completed","Concluídos"],["archived","Arquivados"]].map(([value,label]) => `<option value="${value}" ${ui.projectFilter === value ? "selected" : ""}>${label}</option>`).join("")}
      </select>
    </div>
    <section class="project-grid">${projects.length ? projects.map(projectCard).join("") : emptyState("projects", "Nada por aqui", "Altere os filtros ou crie um novo projeto.")}</section>
    <button class="fab" data-action="add-project" aria-label="Adicionar projeto">${icon("plus")}</button>
  </div>`;
}

function projectCard(project) {
  const logged = project.loggedMinutes;
  const percentage = project.percentage;
  const subtasks = Array.isArray(project.subtasks) ? project.subtasks : [];
  const completedSubtasks = subtasks.filter((subtask) => subtask.completed).length;
  const allocatedMinutes = subtasks.reduce((sum, subtask) => sum + Number(subtask.estimateMinutes || 0), 0);
  const [label, chipClass] = statusMeta(project.status);
  return `<article class="card project-card" style="--project-progress:${percentage}%;--project-color:${project.status === "risk" ? "var(--danger)" : project.color}">
    <div class="project-head"><div><span class="chip ${chipClass}">${label}</span><h2 class="project-title">${escapeHtml(project.name)}</h2><p class="project-client">${escapeHtml(project.client || "Projeto interno")}</p>${subtasks.length ? `<p class="project-subtask-summary">${icon("check", "icon-sm")} ${completedSubtasks}/${subtasks.length} etapas · ${formatDuration(allocatedMinutes, true)} distribuídas</p>` : ""}</div><div class="menu-wrap"><button class="icon-button" data-action="project-menu" data-id="${project.id}" aria-label="Ações de ${escapeHtml(project.name)}" aria-expanded="${ui.menuId === project.id}">${icon("more")}</button>${ui.menuId === project.id ? projectMenu(project) : ""}</div></div>
    <div class="project-progress"><div class="progress-labels"><span>${formatDuration(logged, true)} registradas</span><span>${formatDuration(project.estimateMinutes, true)} estimadas</span></div><div class="progress-track"><span></span></div></div>
    <div class="project-footer"><span>${percentage}% utilizado</span><button class="project-open" data-action="project-detail" data-id="${project.id}">Ver detalhes ${icon("chevron", "icon-sm")}</button></div>
  </article>`;
}

function projectMenu(project) {
  return `<div class="context-menu"><button data-action="edit-project" data-id="${project.id}">${icon("edit", "icon-sm")}Editar</button><button data-action="set-timer-project" data-id="${project.id}">${icon("clock", "icon-sm")}Usar no timer</button><button data-action="archive-project" data-id="${project.id}">${icon("archive", "icon-sm")}${project.archived ? "Restaurar" : "Arquivar"}</button><button class="danger" data-action="delete-project" data-id="${project.id}">${icon("trash", "icon-sm")}Excluir</button></div>`;
}

function renderStats() {
  const range = Number(ui.chartRange);
  const stats = state.analytics?.[range] || { days: [], values: [], total: 0, averageMinutes: 0, delta: 0, topProject: null, maxMinutes: 1, overLimitDays: [] };
  const { days, values, total, delta, topProject: top, maxMinutes: max } = stats;
  const entries = sortedEntries();
  const overLimitDays = Array.isArray(stats.overLimitDays) ? stats.overLimitDays : [];
  const correctionWarning = overLimitDays.length
    ? `<aside class="data-warning">${icon("alert")}<div><strong>${overLimitDays.length === 1 ? "Um dia ultrapassou 24h" : `${overLimitDays.length} dias ultrapassaram 24h`}</strong><p>O gráfico foi limitado a 24h por dia. Corrija ou exclua os lançamentos incorretos no histórico abaixo.</p></div></aside>`
    : "";
  return `<div class="page">
    <div class="page-header"><div><p class="eyebrow">Visão de produtividade</p><h1 class="page-title">Estatísticas</h1><p class="page-subtitle">Entenda seus padrões e ajuste o ritmo com dados reais.</p></div></div>
    <div class="stats-grid">
      <article class="card stats-card highlight"><div class="metric-label">${icon("clock")}Total no período</div><p class="stats-big-number">${(total / 60).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}h</p><p class="metric-trend ${delta >= 0 ? "positive" : ""}">${icon("trend", "icon-sm")} ${delta >= 0 ? "+" : ""}${delta}% em relação ao período anterior</p></article>
      <article class="card stats-card"><div class="metric-label">${icon("target")}Média diária</div><p class="metric-value">${formatDuration(stats.averageMinutes, true)}</p><p class="metric-trend">Com base nos últimos ${range} dias</p></article>
    </div>
    <article class="card active-project-card"><div class="metric-label">${icon("spark")}Projeto mais ativo</div><h2 class="active-project-name">${escapeHtml(top?.project?.name || "Sem dados")}</h2><div class="progress-labels"><span>Tempo registrado</span><span>${formatDuration(top?.minutes || 0, true)}</span></div><div class="progress-track" style="--project-progress:${total ? Math.round(((top?.minutes || 0) / total) * 100) : 0}%;--project-color:${top?.project?.color || "var(--primary)"}"><span></span></div></article>
    <article class="card chart-card"><div class="chart-head"><div><h2 class="section-title">Horas por dia</h2><p class="section-note">Distribuição do tempo registrado</p></div><select class="select mono" id="chart-range" aria-label="Período do gráfico"><option value="7" ${range === 7 ? "selected" : ""}>7 dias</option><option value="30" ${range === 30 ? "selected" : ""}>30 dias</option></select></div>
      <div class="chart chart-${range}" role="img" aria-label="Gráfico de horas registradas por dia">${chartLine(days, values, max, range)}</div>
    </article>
    ${correctionWarning}
    <div class="section-heading"><div><h2 class="section-title">Histórico de lançamentos</h2><p class="section-note">Use o lápis para corrigir início, fim, duração, descrição ou projeto.</p></div><button class="btn btn-small" data-action="manual-entry">${icon("plus", "icon-sm")}Novo lançamento</button></div>
    <section class="card activity-list">${entries.length ? entries.map(activityRow).join("") : emptyState("clock", "Nenhum lançamento", "Registre uma sessão para começar seu histórico.")}</section>
  </div>`;
}

function chartLine(days, values, max, range) {
  const width = 1000;
  const baseline = 204;
  const ceiling = 18;
  const safeMax = Math.max(1, Number(max) || 1);
  const points = days.map((dateKey, index) => {
    const x = days.length <= 1 ? width / 2 : (index / (days.length - 1)) * width;
    const minutes = Math.max(0, Number(values[index]) || 0);
    const y = baseline - (minutes / safeMax) * (baseline - ceiling);
    return { dateKey, minutes, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  });
  const pointString = points.map(({ x, y }) => `${x},${y}`).join(" ");
  const areaPath = points.length
    ? `M ${points[0].x} ${baseline} L ${points.map(({ x, y }) => `${x} ${y}`).join(" L ")} L ${points.at(-1).x} ${baseline} Z`
    : "";
  const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = baseline - ratio * (baseline - ceiling);
    return `<line class="chart-grid-line" x1="0" y1="${y}" x2="${width}" y2="${y}"/>`;
  }).join("");
  const labels = days.map((dateKey) => {
    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const label = range === 7
      ? new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", "")
      : (date.getDate() % 5 === 0 || dateKey === localDateKey() ? String(date.getDate()) : "");
    return `<span>${escapeHtml(label)}</span>`;
  }).join("");
  const markers = points.map(({ dateKey, minutes, x, y }) => `<circle class="chart-point" cx="${x}" cy="${y}" r="4"><title>${escapeHtml(formatEntryDate(dateKey))}: ${escapeHtml(formatDuration(minutes, true))}</title></circle>`).join("");
  return `<svg class="chart-svg" viewBox="0 0 ${width} 220" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="focusflow-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".22"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>${grid}${areaPath ? `<path class="chart-area" d="${areaPath}"/>` : ""}${pointString ? `<polyline class="chart-line" points="${pointString}"/>${markers}` : ""}</svg><div class="chart-labels" style="--chart-columns:${Math.max(1, days.length)}">${labels}</div>`;
}

function renderSettings() {
  const unreadNotifications = Math.max(0, Number(state.notifications?.unreadCount || 0));
  const notificationsDescription = !state.settings.notifications
    ? "Alertas e lembretes desativados"
    : unreadNotifications
      ? `${unreadNotifications} notificação${unreadNotifications === 1 ? "" : "es"} não lida${unreadNotifications === 1 ? "" : "s"}`
      : "Ativados · tudo em dia";
  const updateRow = desktopUpdateStatus
    ? `<button class="settings-row" data-action="desktop-updates">${icon("download")}<span class="settings-copy"><span class="settings-title">Atualizações</span><span class="settings-description">${escapeHtml(desktopUpdateStatus.message)}</span></span>${icon("chevron", "settings-chevron")}</button>`
    : "";
  return `<div class="page" style="max-width:820px">
    <div class="page-header"><div><p class="eyebrow">Preferências</p><h1 class="page-title">Configurações</h1><p class="page-subtitle">Deixe o FocusFlow com a sua cara e o seu ritmo.</p></div></div>
    <section class="card profile-card">${avatarMarkup("avatar-lg")}<div><h2>${escapeHtml(state.profile.name)}</h2><p>${escapeHtml(state.profile.email)}</p><div class="chips"><span class="chip">${escapeHtml(state.profile.plan)}</span><span class="chip">Workspace: ${escapeHtml(state.profile.workspace)}</span></div></div><button class="btn" data-action="edit-profile">Editar perfil</button></section>
    <section class="card settings-list">
      <button class="settings-row" data-action="notification-settings">${icon("bell")}<span class="settings-copy"><span class="settings-title">Notificações</span><span class="settings-description">${notificationsDescription}</span></span>${icon("chevron", "settings-chevron")}</button>
      <button class="settings-row" data-action="daily-goal">${icon("target")}<span class="settings-copy"><span class="settings-title">Meta diária</span><span class="settings-description">${formatDuration(state.settings.dailyGoalMinutes, true)} de foco por dia</span></span>${icon("chevron", "settings-chevron")}</button>
      <button class="settings-row" data-action="export-data">${icon("download")}<span class="settings-copy"><span class="settings-title">Exportar dados</span><span class="settings-description">Baixe seu histórico em CSV ou JSON</span></span>${icon("chevron", "settings-chevron")}</button>
      ${updateRow}
      <button class="settings-row" data-action="about">${icon("info")}<span class="settings-copy"><span class="settings-title">Sobre</span><span class="settings-description">Versão ${escapeHtml(APP_VERSION)} · ${CLIENT_PLATFORM}</span></span>${icon("chevron", "settings-chevron")}</button>
    </section>
    <div class="settings-logout"><button class="btn btn-danger" data-action="logout">${icon("logout")}Redefinir dados do workspace</button></div>
  </div>`;
}

function notificationPanel() {
  const notifications = state.notifications || { enabled: false, items: [], unreadCount: 0 };
  const items = Array.isArray(notifications.items) ? notifications.items : [];
  const emptyMessage = notifications.enabled
    ? "Tudo em dia. Novos alertas aparecerão aqui."
    : "Ative as notificações nas configurações para receber alertas.";
  return `<aside class="notification-panel" aria-label="Notificações">
    <div class="notification-panel-head"><h2>Notificações</h2>${notifications.unreadCount ? '<button class="notification-mark-read" data-action="notifications-read">Marcar como lidas</button>' : ""}</div>
    <div class="notification-list">${items.length ? items.map(notificationItemMarkup).join("") : `<div class="notification-empty">${icon("check")}<p>${emptyMessage}</p></div>`}</div>
  </aside>`;
}

function notificationItemMarkup(item) {
  const iconName = ({ timer: "clock", deadline: "calendar", estimate: "alert", risk: "alert", weekly: "stats", goal: "target" })[item.type] || "bell";
  const target = ["home", "project", "stats"].includes(item.target) ? item.target : "";
  const attributes = target
    ? `type="button" data-action="notification-open" data-notification-id="${escapeHtml(item.id)}" data-target="${target}"${item.projectId ? ` data-project-id="${escapeHtml(item.projectId)}"` : ""}`
    : "";
  const tag = target ? "button" : "div";
  return `<${tag} class="notification-item ${target ? "notification-item-button" : ""} ${item.read ? "" : "unread"}" ${attributes}>${icon(iconName)}<div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p><time>${formatEntryDate(item.date)}</time></div>${target ? icon("chevron", "icon-sm notification-open-icon") : ""}</${tag}>`;
}

function renderModal() {
  const root = document.querySelector("#modal-root");
  if (!ui.modal) { root.innerHTML = ""; return; }
  const { type, data = {} } = ui.modal;
  const content = ({
    projectForm: () => projectFormModal(data), manualEntry: () => manualEntryModal(data), timerCorrection: timerCorrectionModal, dailyGoal: dailyGoalModal, chooseProject: chooseProjectModal,
    projectDetail: () => projectDetailModal(data), profile: profileModal, notifications: notificationSettingsModal, export: exportModal,
    about: aboutModal, updates: updatesModal, confirmDelete: () => confirmDeleteModal(data), confirmDeleteEntry: () => confirmDeleteEntryModal(data), logout: logoutModal,
  })[type]?.();
  root.innerHTML = content || "";
  requestAnimationFrame(() => {
    if (type === "projectDetail") {
      document.activeElement?.blur?.();
      root.querySelector(".modal")?.scrollTo({ top: 0 });
      return;
    }
    root.querySelector("input:not([type=hidden]):not([type=radio]), select, button")?.focus();
  });
}

function modalShell(title, body, footer = "", size = "") {
  return `<div class="modal-backdrop" data-action="close-modal"><section class="modal ${size}" role="dialog" aria-modal="true" aria-labelledby="modal-title" data-modal-panel><header class="modal-header"><h2 class="modal-title" id="modal-title">${title}</h2><button class="icon-button" data-action="close-modal" aria-label="Fechar">${icon("close")}</button></header>${body}${footer}</section></div>`;
}

function projectFormModal(data) {
  const project = data.id ? projectById(data.id) : null;
  const p = project || { name: "", client: "", status: "active", estimateMinutes: 3600, dueDate: "", color: "#3b82f6" };
  const colors = ["#3b82f6", "#45bd8a", "#f59e0b", "#a78bfa", "#f87171"];
  return modalShell(project ? "Editar projeto" : "Novo projeto", `<form id="project-form" data-form="project" class="modal-body form-grid"><input type="hidden" name="id" value="${p.id || ""}"/><div class="field"><label for="project-name">Nome do projeto</label><input class="input" id="project-name" name="name" required maxlength="80" value="${escapeHtml(p.name)}" placeholder="Ex.: Novo site institucional"/></div><div class="field"><label for="project-client">Cliente ou área</label><input class="input" id="project-client" name="client" maxlength="80" value="${escapeHtml(p.client)}" placeholder="Ex.: Acme Corp"/></div><div class="form-row"><div class="field"><label for="project-status">Status</label><select class="select" id="project-status" name="status">${[["active","Ativo"],["ontrack","No prazo"],["risk","Em risco"],["completed","Concluído"],["planned","Planejado"]].map(([value,label]) => `<option value="${value}" ${p.status === value ? "selected" : ""}>${label}</option>`).join("")}</select></div><div class="field"><label for="project-estimate">Estimativa (horas)</label><input class="input" id="project-estimate" name="estimate" type="number" min="0.5" max="10000" step="0.5" required value="${p.estimateMinutes / 60}"/></div></div><div class="field"><label for="project-due-date">Prazo (opcional)</label><input class="input" id="project-due-date" name="dueDate" type="date" value="${escapeHtml(p.dueDate || "")}"/><span class="field-hint">Usado pelo backend para avisar sobre entregas próximas ou atrasadas.</span></div><div class="field"><label>Cor do projeto</label><div class="color-options">${colors.map((color) => `<label class="color-option"><input type="radio" name="color" value="${color}" ${p.color === color ? "checked" : ""}/><span class="color-dot" style="--option-color:${color}"></span></label>`).join("")}</div></div></form>`, `<footer class="modal-footer"><button class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="submit" form="project-form">${project ? "Salvar alterações" : "Criar projeto"}</button></footer>`);
}

function activeProjectOptions(selected = state.timer.projectId, includeSelectedArchived = false) {
  return state.projects.filter((project) => !project.archived || (includeSelectedArchived && project.id === selected)).map((project) => `<option value="${project.id}" ${selected === project.id ? "selected" : ""}>${escapeHtml(project.name)}${project.archived ? " (arquivado)" : ""}</option>`).join("");
}

function manualEntryModal(data = {}) {
  const entry = data.id ? entryById(data.id) : null;
  const selectedProjectId = entry?.projectId || state.timer.projectId;
  const selectedProject = projectById(selectedProjectId);
  const timing = entryTimeDefaults(entry);
  const title = entry ? "Corrigir lançamento" : "Lançamento manual";
  const guidance = entry
    ? `<p class="modal-message">Corrija o período exato e o tempo realmente trabalhado. O sistema impedirá sobreposição e mais de 24 horas no mesmo dia.</p>`
    : `<p class="modal-message">Informe quando o trabalho começou e terminou. Os horários serão salvos no fuso de Brasília.</p>`;
  const legacyWarning = timing.legacy
    ? `<aside class="legacy-time-warning">${icon("alert", "icon-sm")}<span>Este registro antigo não possuía horários. Confira o início e o fim sugeridos antes de salvar.</span></aside>`
    : "";
  const projectField = entry
    ? `<div class="fixed-entry-project">${icon("projects")}<div><span>Projeto original · não pode ser alterado na correção</span><strong>${escapeHtml(selectedProject?.name || entry.projectName || "Projeto removido")}${entry.subtaskTitle ? ` › ${escapeHtml(entry.subtaskTitle)}` : ""}</strong><small>${escapeHtml(selectedProject?.client || entry.projectClient || "Projeto interno")}</small></div></div>`
    : `<div class="field"><label for="manual-project">Projeto</label><select class="select" id="manual-project" name="projectId" required>${activeProjectOptions(selectedProjectId, false)}</select></div>`;
  return modalShell(title, `<form id="manual-form" data-form="manual" data-sync-duration class="modal-body form-grid">
    <input type="hidden" name="id" value="${escapeHtml(entry?.id || "")}"/>
    ${guidance}
    ${legacyWarning}
    <div class="correction-target">${icon(entry ? "edit" : "clock")}<div><strong>${entry ? "Revisão completa do lançamento" : "Novo período de trabalho"}</strong><span>${entry ? `Original: ${formatDuration(entry.minutes, true)} · ${formatEntryDate(entry.date)}` : "Início, fim e duração ficam vinculados"}</span></div></div>
    ${projectField}
    <div class="field"><label for="manual-title">Descrição</label><input class="input" id="manual-title" name="title" maxlength="100" required value="${escapeHtml(entry?.title || "")}" placeholder="O que você fez?"/></div>
    <fieldset class="entry-time-fields">
      <legend>Período do lançamento</legend>
      <div class="time-zone-note">${icon("clock", "icon-sm")}Horário de Brasília · ${APP_TIME_ZONE}</div>
      <div class="form-row">
        <div class="field"><label for="manual-started-at">Começou em</label><input class="input" id="manual-started-at" name="startedAt" type="datetime-local" required value="${escapeHtml(timing.startedAt)}"/></div>
        <div class="field"><label for="manual-ended-at">Terminou em</label><input class="input" id="manual-ended-at" name="endedAt" type="datetime-local" required value="${escapeHtml(timing.endedAt)}"/></div>
      </div>
      <div class="field"><label for="manual-minutes">Tempo realmente trabalhado (minutos)</label><input class="input" id="manual-minutes" name="minutes" type="number" min="1" max="1440" required value="${Number(entry?.minutes || 30)}"/><span class="field-hint">Alterado automaticamente ao ajustar os horários. Você pode reduzir para descontar pausas.</span></div>
    </fieldset>
  </form>`, `<footer class="modal-footer"><button class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="submit" form="manual-form">${entry ? "Salvar lançamento corrigido" : "Adicionar lançamento"}</button></footer>`, entry ? "entry-correction-modal" : "");
}

function timerCorrectionModal() {
  const project = projectById(state.timer.projectId);
  const subtask = project?.subtasks?.find((item) => item.id === state.timer.subtaskId);
  const calculatedMinutes = Math.max(1, Math.round(currentTimerSeconds() / 60));
  const endedAt = brazilDateTimeLocal();
  const startedAt = brazilDateTimeLocal(Number(state.timer.sessionStartedAt) || Date.now() - currentTimerSeconds() * 1000);
  return modalShell("Revisar sessão", `<form id="timer-correction-form" data-form="timerCorrection" data-sync-duration class="modal-body form-grid">
    <p class="modal-message">Confira quando a sessão realmente começou e terminou. Se o cronômetro ficou ligado, corrija os horários antes de registrar.</p>
    <div class="correction-target">${icon("clock")}<div><strong>${escapeHtml(subtask?.title || project?.name || "Sessão de foco")}</strong><span>${escapeHtml(subtask ? project?.name || "" : "Cronômetro pausado para revisão")}</span></div></div>
    <div class="field"><label for="timer-correction-title">Descrição</label><input class="input" id="timer-correction-title" name="title" maxlength="100" required value="Sessão de foco"/></div>
    <fieldset class="entry-time-fields">
      <legend>Período real</legend>
      <div class="time-zone-note">${icon("clock", "icon-sm")}Horário de Brasília · ${APP_TIME_ZONE}</div>
      <div class="form-row">
        <div class="field"><label for="timer-correction-started-at">Começou em</label><input class="input" id="timer-correction-started-at" name="startedAt" type="datetime-local" required value="${escapeHtml(startedAt)}"/></div>
        <div class="field"><label for="timer-correction-ended-at">Terminou em</label><input class="input" id="timer-correction-ended-at" name="endedAt" type="datetime-local" required value="${escapeHtml(endedAt)}"/></div>
      </div>
      <div class="field"><label for="timer-correction-minutes">Tempo realmente trabalhado (minutos)</label><input class="input" id="timer-correction-minutes" name="minutes" type="number" min="1" max="1440" required value="${calculatedMinutes}"/><span class="field-hint">Cronômetro ativo: ${formatDuration(calculatedMinutes, true)}. Reduza para descontar pausas.</span></div>
    </fieldset>
  </form>`, `<footer class="modal-footer"><button class="btn" data-action="close-modal">Continuar pausado</button><button class="btn btn-primary" type="submit" form="timer-correction-form">Registrar sessão corrigida</button></footer>`, "entry-correction-modal");
}

function dailyGoalModal() {
  return modalShell("Meta diária", `<form id="goal-form" data-form="goal" class="modal-body form-grid"><p class="modal-message">Defina quanto tempo quer dedicar ao foco por dia. O progresso aparece no início e nas notificações.</p><div class="field"><label for="goal-hours">Horas por dia</label><input class="input" id="goal-hours" name="hours" type="number" min="0.5" max="24" step="0.5" required value="${state.settings.dailyGoalMinutes / 60}"/><span class="field-hint">Hoje: ${formatDuration(todayMinutes(), true)} registrados</span></div></form>`, `<footer class="modal-footer"><button class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="submit" form="goal-form">Salvar meta</button></footer>`);
}

function chooseProjectModal() {
  const projects = state.projects.filter((project) => !project.archived);
  const groups = projects.map((project) => {
    const projectSelected = state.timer.projectId === project.id;
    const wholeProjectSelected = projectSelected && !state.timer.subtaskId;
    const subtasks = Array.isArray(project.subtasks) ? project.subtasks : [];
    const subtaskOptions = subtasks.map((subtask) => {
      const selected = projectSelected && state.timer.subtaskId === subtask.id;
      return `<button class="timer-target-option subtask-option ${selected ? "selected" : ""} ${subtask.completed ? "completed" : ""}" type="button" data-action="choose-project" data-id="${project.id}" data-subtask-id="${subtask.id}" aria-pressed="${selected}"><span class="timer-target-check">${selected ? icon("check", "icon-sm") : ""}</span><span class="timer-target-copy"><strong>${escapeHtml(subtask.title)}</strong><small>${subtask.completed ? "Concluída" : "Subtarefa"} · ${formatDuration(subtask.estimateMinutes, true)}</small></span></button>`;
    }).join("");
    return `<section class="timer-target-group"><div class="timer-target-group-head"><span class="activity-dot" style="--row-color:${project.color}"></span><div><h3>${escapeHtml(project.name)}</h3><p>${escapeHtml(project.client || "Projeto interno")}</p></div></div><div class="timer-target-options"><button class="timer-target-option ${wholeProjectSelected ? "selected" : ""}" type="button" data-action="choose-project" data-id="${project.id}" data-subtask-id="" aria-pressed="${wholeProjectSelected}"><span class="timer-target-check">${wholeProjectSelected ? icon("check", "icon-sm") : icon("projects", "icon-sm")}</span><span class="timer-target-copy"><strong>Projeto inteiro</strong><small>Registrar sem vincular a uma subtarefa</small></span></button>${subtaskOptions}</div></section>`;
  }).join("");
  const content = groups || `<div class="subtask-empty">${icon("projects")}<strong>Nenhum projeto disponível</strong><span>Crie um projeto antes de configurar o cronômetro.</span></div>`;
  return modalShell("Projeto e subtarefa", `<div class="modal-body timer-target-picker"><p class="timer-target-intro">Escolha onde a próxima sessão de foco será registrada.</p>${content}</div>`, "", "timer-target-modal");
}

function projectDetailModal(data) {
  const project = projectById(data.id);
  if (!project) return "";
  const logged = projectMinutes(project.id);
  const [label, chipClass] = statusMeta(project.status);
  const entryCount = project.entryCount;
  const subtasks = Array.isArray(project.subtasks) ? project.subtasks : [];
  const completedSubtasks = subtasks.filter((subtask) => subtask.completed).length;
  const allocatedMinutes = subtasks.reduce((sum, subtask) => sum + Number(subtask.estimateMinutes || 0), 0);
  const availableMinutes = Math.max(0, Number(project.estimateMinutes || 0) - allocatedMinutes);
  const taskProgress = subtasks.length ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;
  const timeProgress = project.estimateMinutes ? Math.round((logged / project.estimateMinutes) * 100) : 0;
  const timeProgressWidth = Math.min(100, timeProgress);
  const allocationProgress = project.estimateMinutes ? Math.round((allocatedMinutes / project.estimateMinutes) * 100) : 0;
  const remainingMinutes = Number(project.estimateMinutes || 0) - logged;
  const timeBalance = remainingMinutes >= 0
    ? `<span>${formatDuration(remainingMinutes, true)} ainda disponíveis</span>`
    : `<span class="project-time-over">${formatDuration(Math.abs(remainingMinutes), true)} acima da estimativa</span>`;
  const editingSubtask = data.editSubtaskId ? subtasks.find((subtask) => subtask.id === data.editSubtaskId) : null;
  const subtaskList = subtasks.length
    ? subtasks.map((subtask) => `<article class="subtask-item ${subtask.completed ? "completed" : ""}"><button class="subtask-toggle" type="button" data-action="subtask-set-completed" data-project-id="${project.id}" data-id="${subtask.id}" data-completed="${subtask.completed}" aria-label="${subtask.completed ? "Reabrir" : "Concluir"} ${escapeHtml(subtask.title)}"><span class="subtask-checkbox">${subtask.completed ? icon("check", "icon-sm") : ""}</span><span class="subtask-copy"><strong class="subtask-title">${escapeHtml(subtask.title)}</strong><small>${subtask.completed ? "Concluída" : "Pendente"} · ${formatDuration(subtask.loggedMinutes, true)} registrados</small></span><span class="subtask-hours mono">${formatDuration(subtask.estimateMinutes, true)}</span></button><div class="subtask-actions"><button class="icon-button subtask-edit" type="button" data-action="edit-subtask" data-id="${subtask.id}" aria-label="Editar ${escapeHtml(subtask.title)}">${icon("edit", "icon-sm")}</button><button class="icon-button subtask-delete" type="button" data-action="subtask-delete" data-project-id="${project.id}" data-id="${subtask.id}" aria-label="Excluir ${escapeHtml(subtask.title)}">${icon("trash", "icon-sm")}</button></div></article>`).join("")
    : `<div class="subtask-empty">${icon("projects")}<strong>Comece dividindo o projeto</strong><span>Transforme as ${formatDuration(project.estimateMinutes, true)} estimadas em etapas menores.</span></div>`;
  const cancelEdit = editingSubtask ? `<button class="btn btn-ghost btn-small subtask-cancel" type="button" data-action="cancel-subtask-edit">Cancelar edição</button>` : "";
  const taskLabel = `${completedSubtasks} de ${subtasks.length} concluída${completedSubtasks === 1 ? "" : "s"}`;

  return modalShell("Detalhes do projeto", `<div class="modal-body project-detail-body" style="--project-detail-color:${project.color || "var(--primary)"}">
    <section class="project-detail-hero">
      <div class="project-detail-head">
        <div><span class="project-detail-eyebrow">${icon("projects", "icon-sm")} Projeto</span><h3>${escapeHtml(project.name)}</h3><p>${escapeHtml(project.client || "Projeto interno")}</p></div>
        <span class="chip ${chipClass}">${label}</span>
      </div>
      <div class="project-time-head"><div><span>Tempo registrado</span><strong class="mono">${formatDuration(logged, true)}</strong><small>de ${formatDuration(project.estimateMinutes, true)}</small></div><b class="mono">${timeProgress}%</b></div>
      <div class="progress-track project-detail-time-progress" role="progressbar" aria-label="Tempo consumido" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${timeProgressWidth}"><span style="width:${timeProgressWidth}%"></span></div>
      <div class="project-time-balance">${timeBalance}<span>${entryCount} registro${entryCount === 1 ? "" : "s"}</span></div>
    </section>

    <dl class="project-detail-metrics">
      <div><dt>${icon("flag", "icon-sm")}Estimativa</dt><dd class="mono">${formatDuration(project.estimateMinutes, true)}</dd></div>
      <div><dt>${icon("calendar", "icon-sm")}Prazo</dt><dd>${project.dueDate ? formatEntryDate(project.dueDate) : "Sem prazo"}</dd></div>
      <div><dt>${icon("clock", "icon-sm")}Registros</dt><dd>${entryCount}</dd></div>
      <div><dt>${icon("play", "icon-sm")}Início</dt><dd>${formatEntryDate(project.createdAt)}</dd></div>
    </dl>

    <section class="subtask-section" aria-labelledby="subtask-heading">
      <div class="subtask-section-head"><div><span class="section-kicker">Planejamento</span><h3 id="subtask-heading">Subtarefas</h3><p>Reparta a estimativa do projeto entre etapas.</p></div><span class="subtask-total">${subtasks.length}</span></div>
      <div class="subtask-progress-grid">
        <div class="subtask-progress-card"><div class="subtask-progress-label"><span>Conclusão</span><strong class="mono">${taskProgress}%</strong></div><div class="progress-track subtask-progress"><span style="width:${taskProgress}%"></span></div><small>${taskLabel}</small></div>
        <div class="subtask-progress-card"><div class="subtask-progress-label"><span>Horas distribuídas</span><strong class="mono">${allocationProgress}%</strong></div><div class="progress-track subtask-allocation-progress"><span style="width:${Math.min(100, allocationProgress)}%"></span></div><div class="subtask-budget"><span>${formatDuration(allocatedMinutes, true)} distribuídas</span><strong>${formatDuration(availableMinutes, true)} livres</strong></div></div>
      </div>

      <div class="subtask-composer ${editingSubtask ? "editing" : ""}">
        <div class="subtask-composer-head"><div><h4>${editingSubtask ? "Editar subtarefa" : "Nova subtarefa"}</h4><p>${editingSubtask ? "Ajuste o nome ou as horas desta etapa." : "Informe uma etapa e reserve parte das horas."}</p></div>${editingSubtask ? `<span class="chip warning">Editando</span>` : ""}</div>
        <form class="subtask-create" data-form="subtask">
          <input type="hidden" name="projectId" value="${project.id}"/>
          <input type="hidden" name="id" value="${editingSubtask?.id || ""}"/>
          <label class="subtask-title-field"><span>Título da subtarefa</span><input class="input" id="subtask-title" name="title" required maxlength="120" autocomplete="off" value="${escapeHtml(editingSubtask?.title || "")}" placeholder="Ex.: Validar telas com o cliente"/></label>
          <label class="subtask-estimate"><span>Horas</span><input class="input" name="estimate" type="number" min="0.25" max="10000" step="0.25" required value="${editingSubtask ? editingSubtask.estimateMinutes / 60 : ""}" placeholder="1"/></label>
          <button class="btn btn-primary" type="submit">${icon(editingSubtask ? "check" : "plus", "icon-sm")}${editingSubtask ? "Salvar" : "Adicionar"}</button>
          ${cancelEdit}
        </form>
      </div>

      <div class="subtask-list-head"><h4>Etapas do projeto</h4><span>${taskLabel}</span></div>
      <div class="subtask-list">${subtaskList}</div>
    </section>
  </div>`, `<footer class="modal-footer project-detail-footer"><button class="btn" data-action="edit-project" data-id="${project.id}">${icon("edit", "icon-sm")}Editar projeto</button><button class="btn btn-primary" data-action="set-timer-project" data-id="${project.id}">${icon("clock", "icon-sm")}Usar no timer</button></footer>`, "project-detail-modal");
}

function profileModal() {
  return modalShell("Editar perfil", `<form id="profile-form" data-form="profile" class="modal-body form-grid">
    <div class="field"><label for="profile-name">Nome</label><input class="input" id="profile-name" name="name" required maxlength="70" value="${escapeHtml(state.profile.name)}"/></div>
    <div class="field"><label for="profile-workspace">Workspace</label><input class="input" id="profile-workspace" name="workspace" required maxlength="70" value="${escapeHtml(state.profile.workspace)}"/></div>
  </form>`, `<footer class="modal-footer"><button class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-primary" type="submit" form="profile-form">Salvar perfil</button></footer>`);
}

function notificationSettingsModal() {
  const row = (id, title, description, checked) => `<label class="settings-row" for="${id}"><span class="settings-copy"><span class="settings-title">${title}</span><span class="settings-description">${description}</span></span><span class="switch"><input id="${id}" name="${id}" type="checkbox" ${checked ? "checked" : ""}/><span class="switch-track"></span></span></label>`;
  return modalShell("Notificações", `<form id="notifications-form" data-form="notifications" class="modal-body card settings-list" style="padding:0;margin:0">${row("notifications", "Permitir notificações", IS_NATIVE_CLIENT ? "Receber alertas também na barra do dispositivo" : "Receber alertas calculados pelo backend", state.settings.notifications)}${row("timerAlerts", "Cronômetro esquecido", "Avisar quando uma sessão passar de 4 horas", state.settings.timerAlerts)}${row("goalReminders", "Meta diária", "Avisar quando a meta do dia for concluída", state.settings.goalReminders)}${row("riskAlerts", "Estimativas e riscos", "Avisar em 80%, 100% ou quando o projeto estiver em risco", state.settings.riskAlerts)}${row("deadlineAlerts", "Prazos", "Avisar sobre entregas de hoje, amanhã ou atrasadas", state.settings.deadlineAlerts)}${row("weeklySummary", "Resumo semanal", "Mostrar o resultado consolidado da semana anterior", state.settings.weeklySummary)}</form>`, `<footer class="modal-footer"><button class="btn btn-primary" type="submit" form="notifications-form">Salvar preferências</button></footer>`);
}

function exportModal() {
  return modalShell("Exportar dados", `<div class="modal-body form-grid"><p class="modal-message">Baixe seus registros para analisar em outra ferramenta ou faça uma cópia de segurança completa.</p><button class="btn btn-block" data-action="export-csv">${icon("file")}Exportar registros em CSV</button><button class="btn btn-block" data-action="export-json">${icon("download")}Backup completo em JSON</button><button class="btn btn-block" data-action="print-report">${icon("stats")}Imprimir relatório / salvar PDF</button></div>`);
}

function aboutModal() {
  return modalShell("Sobre o FocusFlow", `<div class="modal-body"><div class="brand" style="margin-bottom:20px"><img class="brand-mark" src="icon.svg" alt=""/>FocusFlow</div><p class="modal-message">Um controle de tempo focado em clareza: projetos, sessões e estatísticas sem distrações.</p><dl class="detail-list"><div class="detail-row"><dt>Versão</dt><dd>${escapeHtml(APP_VERSION)}</dd></div><div class="detail-row"><dt>Processamento</dt><dd>Backend protegido</dd></div><div class="detail-row"><dt>Cliente</dt><dd>${CLIENT_PLATFORM}</dd></div></dl></div>`);
}

function updatesModal() {
  const update = desktopUpdateStatus || { status: "unsupported", message: "Atualizações indisponíveis." };
  const busy = ["checking", "downloading", "installing"].includes(update.status);
  const ready = update.status === "ready";
  const progress = Math.max(0, Math.min(100, Number(update.progress) || 0));
  const version = update.version ? `<div class="detail-row"><dt>Nova versão</dt><dd>${escapeHtml(update.version)}</dd></div>` : "";
  const notes = update.notes ? `<p class="modal-message" style="margin-top:18px">${escapeHtml(update.notes)}</p>` : "";
  const footer = ready
    ? `<footer class="modal-footer"><button class="btn" data-action="close-modal">Depois</button><button class="btn btn-primary" data-action="install-update">Instalar e reiniciar</button></footer>`
    : `<footer class="modal-footer"><button class="btn" data-action="close-modal">Fechar</button><button class="btn btn-primary" data-action="check-update" ${busy ? "disabled" : ""}>${busy ? "Aguarde..." : "Verificar agora"}</button></footer>`;
  return modalShell("Atualizações do FocusFlow", `<div class="modal-body"><p class="modal-message">${escapeHtml(update.message)}</p><div class="progress-track" style="margin:18px 0"><span style="width:${progress}%"></span></div><dl class="detail-list"><div class="detail-row"><dt>Versão instalada</dt><dd>${escapeHtml(update.currentVersion || APP_VERSION)}</dd></div>${version}<div class="detail-row"><dt>Canal</dt><dd>Estável · backend autenticado</dd></div></dl>${notes}</div>`, footer);
}

function confirmDeleteModal(data) {
  const project = projectById(data.id);
  return modalShell("Excluir projeto?", `<div class="modal-body"><p class="modal-message">O projeto <strong>${escapeHtml(project?.name || "")}</strong> e todos os seus registros serão removidos permanentemente.</p></div>`, `<footer class="modal-footer"><button class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-delete-project" data-id="${data.id}">Excluir definitivamente</button></footer>`);
}

function logoutModal() {
  return modalShell("Redefinir dados do workspace?", `<div class="modal-body"><p class="modal-message">Isso apagará no servidor os projetos, registros, perfil e preferências deste workspace em todos os dispositivos. O app voltará aos dados de demonstração.</p></div>`, `<footer class="modal-footer"><button class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-logout">Redefinir dados</button></footer>`);
}

function confirmDeleteEntryModal(data) {
  const entry = entryById(data.id);
  return modalShell("Excluir lançamento?", `<div class="modal-body"><p class="modal-message">O registro <strong>${escapeHtml(entry?.title || "")}</strong> de <strong>${formatDuration(entry?.minutes || 0, true)}</strong> será removido permanentemente.</p></div>`, `<footer class="modal-footer"><button class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-delete-entry" data-id="${escapeHtml(data.id)}">Excluir lançamento</button></footer>`);
}

function openModal(type, data = {}) { ui.modal = { type, data }; ui.menuId = null; renderModal(); }
function closeModal() {
  ui.modal = null;
  renderModal();
  applyPendingRemoteState();
}

function hasActiveDraft() {
  if (document.querySelector("[data-form]")) return true;
  const active = document.activeElement;
  return Boolean(active?.matches?.("input:not([readonly]), textarea, select, [contenteditable=true]"));
}

function applyPendingRemoteState() {
  if (!pendingRemoteState || hasActiveDraft()) return false;
  const cached = pendingRemoteState;
  pendingRemoteState = null;
  state = cached.state;
  remoteRevision = cached.revision;
  hasHydratedState = true;
  render();
  if (cached.announce) toast("Dados carregados do servidor.");
  return true;
}

function updateTimerDisplay() {
  const elapsed = currentTimerSeconds();
  const display = document.querySelector("[data-timer-display]");
  if (display) display.textContent = formatTimer(elapsed);
  const today = todayMinutes();
  const total = document.querySelector("[data-today-total]");
  if (total) total.textContent = formatDuration(today, true);
  const progress = document.querySelector("[data-timer-progress]");
  if (progress) progress.style.setProperty("--progress", `${Math.min(100, Math.round((today / Math.max(1, state.settings.dailyGoalMinutes)) * 100))}%`);
}

function syncAndroidNotificationState() {
  if (typeof globalThis.FocusFlowAndroid?.syncNotificationState !== "function") return;
  const timerProject = projectById(state.timer.projectId);
  const timerSubtask = timerProject?.subtasks?.find((subtask) => subtask.id === state.timer.subtaskId);
  globalThis.FocusFlowAndroid.syncNotificationState(JSON.stringify({
    timer: {
      running: Boolean(state.timer.running),
      elapsedSeconds: currentTimerSeconds(),
      projectName: timerProject?.name || "Sessão de foco",
      subtaskTitle: timerSubtask?.title || "",
    },
    alerts: {
      enabled: Boolean(state.settings.notifications && state.notifications?.enabled),
      items: Array.isArray(state.notifications?.items) ? state.notifications.items : [],
    },
  }));
}

function toast(message, type = "success") {
  const root = document.querySelector("#toast-root");
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.innerHTML = `${icon(type === "error" ? "alert" : "check")}<span>${escapeHtml(message)}</span>`;
  root.append(item);
  setTimeout(() => item.remove(), 3600);
}

function setSyncStatus(status) {
  if (syncStatus === status) return;
  syncStatus = status;
  const current = document.querySelector("[data-sync-status]");
  if (!current) return;
  const labels = { connecting: "Conectando", syncing: "Processando", cached: "Atualização pendente", synced: "Online", offline: "Servidor offline" };
  current.className = `sync-badge ${status}`;
  current.innerHTML = `<span></span>${labels[status]}`;
}

const nativeRequests = new Map();
let nativeRequestSequence = 0;

globalThis.FocusFlowNativeResolve = (requestId, payload) => {
  const pending = nativeRequests.get(requestId);
  if (!pending) return;
  nativeRequests.delete(requestId);
  pending.cleanup();

  if (payload?.error) {
    pending.reject(new Error(payload.error));
    return;
  }

  try {
    const binary = atob(payload.bodyBase64 || "");
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    pending.resolve(new Response(bytes, { status: Number(payload.status), headers: payload.headers || {} }));
  } catch {
    pending.reject(new Error("Resposta inválida do cliente Android."));
  }
};

function nativeApiRequest(path, options, signal) {
  return new Promise((resolve, reject) => {
    const requestId = `native-${Date.now()}-${nativeRequestSequence += 1}`;
    const abort = () => {
      nativeRequests.delete(requestId);
      reject(new DOMException("Tempo de requisição esgotado.", "AbortError"));
    };
    const cleanup = () => signal?.removeEventListener("abort", abort);
    nativeRequests.set(requestId, { resolve, reject, cleanup });
    signal?.addEventListener("abort", abort, { once: true });

    const headers = Object.fromEntries(
      Object.entries(options.headers || {}).map(([name, value]) => [name.toLowerCase(), String(value)]),
    );
    globalThis.FocusFlowAndroid.request(
      requestId,
      options.method || "GET",
      path,
      typeof options.body === "string" ? options.body : "",
      JSON.stringify(headers),
    );
  });
}

async function apiRequest(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(globalThis.FocusFlowConfig?.requestTimeoutMs || 7_000));
  try {
    if (globalThis.FocusFlowAndroid?.request) return await nativeApiRequest(path, options, controller.signal);
    return await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      cache: "no-store",
      credentials: "include",
      headers: { ...options.headers },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function nativeAuthRequest(action, method = "GET") {
  const path = `/native/auth/${action}`;
  const response = globalThis.FocusFlowAndroid?.request
    ? await apiRequest(path, { method })
    : await fetch(path, {
      method,
      cache: "no-store",
      headers: { "X-FocusFlow-Native-Token": NATIVE_UPDATE_TOKEN },
    });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Não foi possível autenticar.");
  return payload;
}

function showNativeLogin(message = "Entre para continuar.", status = "unauthenticated") {
  if (!IS_NATIVE_CLIENT) return;
  nativeAuthentication = { status, message };
  syncStatus = "offline";
  render();
}

async function initializeNativeAuthentication() {
  nativeAuthentication = { status: "checking", message: "Verificando sua sessão segura..." };
  render();
  try {
    const status = await nativeAuthRequest("status");
    if (!status.authenticated) {
      showNativeLogin("Entre uma vez; sua sessão ficará protegida neste dispositivo.");
      return;
    }
    nativeAuthentication = { status: "authenticated", message: "" };
    render();
    await hydrateRemoteState({ announce: true });
  } catch (error) {
    showNativeLogin(error.message || "Não foi possível verificar sua sessão.", "error");
  }
}

async function loginNativeClient() {
  if (!IS_NATIVE_CLIENT || ["checking", "authenticating"].includes(nativeAuthentication.status)) return;
  nativeAuthentication = {
    status: "authenticating",
    message: "Conclua o acesso no navegador e volte ao FocusFlow.",
  };
  render();
  try {
    await nativeAuthRequest("login", "POST");
    nativeAuthentication = { status: "authenticated", message: "" };
    render();
    await hydrateRemoteState({ announce: true });
  } catch (error) {
    showNativeLogin(error.message || "O login não foi concluído. Tente novamente.", "error");
  }
}

async function nativeUpdateRequest(path, method = "GET") {
  if (!NATIVE_UPDATE_TOKEN) throw new Error("Atualizações nativas indisponíveis.");
  const response = await fetch(`/native/updates/${path}`, {
    method,
    cache: "no-store",
    headers: { "X-FocusFlow-Native-Token": NATIVE_UPDATE_TOKEN },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Não foi possível consultar o atualizador.");
  return payload;
}

async function refreshDesktopUpdateStatus({ notify = true } = {}) {
  if (!NATIVE_UPDATE_TOKEN) return;
  try {
    const nextStatus = await nativeUpdateRequest("status");
    const statusChanged = JSON.stringify(nextStatus) !== JSON.stringify(desktopUpdateStatus);
    desktopUpdateStatus = nextStatus;
    if (statusChanged && ui.modal?.type === "updates") renderModal();
    if (statusChanged && ui.route === "settings") render();
    if (notify && desktopUpdateStatus.status === "ready" && updateReadyNoticeVersion !== desktopUpdateStatus.version) {
      updateReadyNoticeVersion = desktopUpdateStatus.version;
      toast(`FocusFlow ${desktopUpdateStatus.version} está pronto para instalar.`);
    }
  } catch {
    // A sincronização dos dados continua mesmo se o serviço local de atualização estiver indisponível.
  }
}

async function runDesktopUpdateOperation(path) {
  try {
    desktopUpdateStatus = await nativeUpdateRequest(path, "POST");
    if (ui.modal?.type === "updates") renderModal();
    if (desktopUpdateStatus.status === "error") toast(desktopUpdateStatus.message, "error");
  } catch (error) {
    toast(error.message, "error");
  }
}

async function performAction(action, payload = {}) {
  setSyncStatus("syncing");
  try {
    const response = await apiRequest("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload, baseRevision: remoteRevision }),
    });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401 && IS_NATIVE_CLIENT) {
        showNativeLogin(result.error || "Sua sessão expirou. Entre novamente.");
        return null;
      }
      if (response.status === 409) hydrateRemoteState();
      throw new Error(result.error || "Não foi possível concluir a ação.");
    }
    state = result.state;
    remoteRevision = result.revision;
    pendingRemoteState = null;
    setSyncStatus("synced");
    render();
    return result;
  } catch (error) {
    setSyncStatus("offline");
    toast(error.message || "Servidor indisponível.", "error");
    return null;
  }
}

async function hydrateRemoteState({ announce = false } = {}) {
  if (IS_NATIVE_CLIENT && nativeAuthentication.status !== "authenticated") return false;
  if (hydrationPromise) return hydrationPromise;

  hydrationPromise = (async () => {
    if (remoteRevision === null) setSyncStatus("connecting");
    else if (announce) setSyncStatus("syncing");

    try {
      const response = await apiRequest("/api/state");
      if (response.status === 401 && IS_NATIVE_CLIENT) {
        const payload = await response.json().catch(() => ({}));
        showNativeLogin(payload.error || "Sua sessão expirou. Entre novamente.");
        return false;
      }
      if (!response.ok) throw new Error("API indisponível.");
      const remote = await response.json();
      const shouldApplyRemote = remote.state && remote.revision !== remoteRevision;
      const firstHydration = !hasHydratedState;
      remoteRevision = remote.revision;
      if (remote.state) hasHydratedState = true;

      if (shouldApplyRemote && hasActiveDraft()) {
        pendingRemoteState = {
          state: remote.state,
          revision: remote.revision,
          announce: Boolean(announce || pendingRemoteState?.announce),
        };
        setSyncStatus("cached");
        return true;
      }

      if (shouldApplyRemote) {
        state = remote.state;
        render();
        if (announce) toast("Dados carregados do servidor.");
      } else if (firstHydration && hasHydratedState) {
        render();
      }

      setSyncStatus(pendingRemoteState ? "cached" : "synced");
      return true;
    } catch {
      setSyncStatus("offline");
      if (!hasHydratedState) render();
      return false;
    }
  })();

  try {
    return await hydrationPromise;
  } finally {
    hydrationPromise = null;
  }
}

async function downloadExport(format) {
  setSyncStatus("syncing");
  try {
    const response = await apiRequest(`/api/export?format=${encodeURIComponent(format)}`);
    if (!response.ok) throw new Error("Não foi possível gerar a exportação.");
    const content = await response.text();
    const filename = response.headers.get("x-focusflow-filename") || `focusflow.${format}`;
    downloadFile(filename, content, response.headers.get("content-type") || "application/octet-stream");
    setSyncStatus("synced");
    toast(format === "csv" ? "Arquivo CSV gerado." : "Backup completo gerado.");
  } catch (error) {
    setSyncStatus("offline");
    toast(error.message, "error");
  }
}

function downloadFile(name, content, type) {
  if (window.FocusFlowAndroid?.saveFile) {
    const bytes = new TextEncoder().encode(content);
    let binary = "";
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    window.FocusFlowAndroid.saveFile(name, btoa(binary), type);
    return;
  }
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.addEventListener("click", (event) => {
  const actionElement = event.target.closest("[data-action]");
  if (!actionElement) {
    if (ui.menuId && !event.target.closest(".menu-wrap")) { ui.menuId = null; render(); }
    else if (ui.notificationsOpen && !event.target.closest(".notification-panel")) { ui.notificationsOpen = false; render(); }
    return;
  }
  const action = actionElement.dataset.action;
  const id = actionElement.dataset.id;
  const projectId = actionElement.dataset.projectId;
  if (action === "close-modal" && event.target.closest("[data-modal-panel]") && actionElement.classList.contains("modal-backdrop")) return;
  if (action !== "close-modal" && actionElement.closest("[data-modal-panel]")) event.stopPropagation();

  const actions = {
    "native-login"() { loginNativeClient(); },
    "retry-hydration"() { syncStatus = "connecting"; render(); hydrateRemoteState({ announce: true }); },
    notifications() { ui.notificationsOpen = !ui.notificationsOpen; render(); },
    async "notifications-read"() {
      const ids = (state.notifications?.items || []).filter((item) => !item.read).map((item) => item.id);
      if (!ids.length) return;
      if (await performAction("notifications-read", { ids })) toast("Notificações marcadas como lidas.");
    },
    async "notification-open"() {
      const notificationId = actionElement.dataset.notificationId;
      const item = (state.notifications?.items || []).find((notification) => notification.id === notificationId);
      if (!item) return;
      if (!item.read) await performAction("notifications-read", { ids: [item.id] });
      ui.notificationsOpen = false;
      if (item.target === "project" && item.projectId && projectById(item.projectId)) {
        ui.route = "projects";
        ui.modal = { type: "projectDetail", data: { id: item.projectId } };
        location.hash = "#projects";
      } else if (item.target === "stats") {
        ui.route = "stats";
        location.hash = "#stats";
      } else {
        ui.route = "home";
        location.hash = "#home";
      }
      render();
    },
    "go-stats"() { location.hash = "#stats"; },
    async "toggle-timer"() {
      const wasRunning = state.timer.running;
      if (await performAction("timer-toggle")) toast(wasRunning ? "Cronômetro pausado." : "Sessão de foco iniciada.");
    },
    async "stop-timer"() {
      if (state.timer.running && !(await performAction("timer-toggle"))) return;
      openModal("timerCorrection");
    },
    "choose-timer-project"() { openModal("chooseProject"); },
    async "choose-project"() {
      const subtaskId = actionElement.dataset.subtaskId || null;
      const project = projectById(id);
      const subtask = project?.subtasks?.find((item) => item.id === subtaskId);
      if (await performAction("timer-project", { id, subtaskId })) { closeModal(); toast(subtask ? `Subtarefa “${subtask.title}” selecionada.` : "Projeto do cronômetro atualizado."); }
    },
    "manual-entry"() { openModal("manualEntry"); },
    "edit-entry"() { openModal("manualEntry", { id }); },
    "delete-entry"() { openModal("confirmDeleteEntry", { id }); },
    async "confirm-delete-entry"() {
      const entry = entryById(id);
      if (await performAction("entry-delete", { id })) { closeModal(); toast(`${entry?.title || "Lançamento"} foi excluído.`); }
    },
    "daily-goal"() { openModal("dailyGoal"); },
    "add-project"() { openModal("projectForm"); },
    "edit-project"() { openModal("projectForm", { id }); },
    "project-detail"() { openModal("projectDetail", { id }); },
    "edit-subtask"() {
      if (ui.modal?.type !== "projectDetail") return;
      ui.modal.data.editSubtaskId = id;
      renderModal();
      requestAnimationFrame(() => document.querySelector("#subtask-title")?.focus());
    },
    "cancel-subtask-edit"() {
      if (ui.modal?.type !== "projectDetail") return;
      delete ui.modal.data.editSubtaskId;
      renderModal();
    },
    async "subtask-set-completed"() {
      const completed = actionElement.dataset.completed === "true";
      if (await performAction("subtask-set-completed", { projectId, id, completed: !completed })) {
        toast(completed ? "Subtarefa reaberta." : "Subtarefa concluída.");
      }
    },
    async "subtask-delete"() {
      if (await performAction("subtask-delete", { projectId, id })) toast("Subtarefa excluída.");
    },
    "project-menu"() { ui.menuId = ui.menuId === id ? null : id; render(); },
    async "set-timer-project"() {
      if (await performAction("timer-project", { id, subtaskId: null })) { ui.modal = null; location.hash = "#home"; render(); toast("Projeto pronto para uma nova sessão."); }
    },
    async "archive-project"() {
      const wasArchived = projectById(id)?.archived;
      if (await performAction("project-archive", { id })) { ui.menuId = null; render(); toast(wasArchived ? "Projeto restaurado." : "Projeto arquivado."); }
    },
    "delete-project"() {
      if (state.timer.projectId === id && state.timer.running) return toast("Finalize o cronômetro antes de excluir este projeto.", "error");
      openModal("confirmDelete", { id });
    },
    async "confirm-delete-project"() {
      const project = projectById(id);
      if (await performAction("project-delete", { id })) { closeModal(); toast(`${project?.name || "Projeto"} foi excluído.`); }
    },
    "edit-profile"() { openModal("profile"); },
    "notification-settings"() { openModal("notifications"); },
    "export-data"() { openModal("export"); },
    "export-csv"() { downloadExport("csv"); },
    "export-json"() { downloadExport("json"); },
    "print-report"() { closeModal(); location.hash = "#stats"; setTimeout(() => window.FocusFlowAndroid?.printPage ? window.FocusFlowAndroid.printPage() : window.print(), 300); },
    "desktop-updates"() { openModal("updates"); refreshDesktopUpdateStatus({ notify: false }); },
    async "check-update"() { await runDesktopUpdateOperation("check"); },
    async "install-update"() { await runDesktopUpdateOperation("install"); },
    about() { openModal("about"); },
    logout() { openModal("logout"); },
    async "confirm-logout"() { if (await performAction("reset")) { ui.modal = null; location.hash = "#home"; render(); toast("Dados redefinidos no servidor."); } },
    "close-modal"() { closeModal(); },
  };
  actions[action]?.();
});

document.addEventListener("submit", (event) => {
  const form = event.target.closest("[data-form]");
  if (!form) return;
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const handlers = {
    async project() {
      if (await performAction("project-save", data)) { closeModal(); toast(data.id ? "Projeto atualizado." : "Projeto criado."); }
    },
    async subtask() {
      const wasEditing = Boolean(data.id);
      if (await performAction("subtask-save", data)) {
        if (ui.modal?.type === "projectDetail") delete ui.modal.data.editSubtaskId;
        renderModal();
        toast(wasEditing ? "Subtarefa atualizada." : "Subtarefa criada.");
        requestAnimationFrame(() => document.querySelector("#subtask-title")?.focus());
      }
    },
    async manual() {
      const editing = Boolean(data.id);
      if (await performAction(editing ? "entry-update" : "entry-create", { ...data, minutes: Number(data.minutes) })) { closeModal(); toast(editing ? "Lançamento corrigido." : "Lançamento adicionado."); }
    },
    async timerCorrection() {
      const project = projectById(state.timer.projectId);
      const subtask = project?.subtasks?.find((item) => item.id === state.timer.subtaskId);
      if (await performAction("timer-stop", { ...data, minutes: Number(data.minutes) })) {
        closeModal();
        toast(`Sessão registrada em ${subtask?.title || project?.name || "seu projeto"}.`);
      }
    },
    async goal() { if (await performAction("goal-save", { hours: Number(data.hours) })) { closeModal(); toast("Meta diária atualizada."); } },
    async profile() { if (await performAction("profile-save", data)) { closeModal(); toast("Perfil atualizado."); } },
    async notifications() { if (await performAction("notifications-save", { notifications: form.elements.notifications.checked, timerAlerts: form.elements.timerAlerts.checked, goalReminders: form.elements.goalReminders.checked, riskAlerts: form.elements.riskAlerts.checked, deadlineAlerts: form.elements.deadlineAlerts.checked, weeklySummary: form.elements.weeklySummary.checked })) { closeModal(); toast("Preferências de notificação salvas."); } },
  };
  handlers[form.dataset.form]?.();
});

function syncEntryDuration(form) {
  if (!form?.matches("[data-sync-duration]")) return;
  const startedAt = form.elements.startedAt?.value;
  const endedAt = form.elements.endedAt?.value;
  const startMatch = String(startedAt || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  const endMatch = String(endedAt || "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!startMatch || !endMatch) return;
  const toWallClock = (parts) => Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), Number(parts[4]), Number(parts[5]));
  const minutes = Math.round((toWallClock(endMatch) - toWallClock(startMatch)) / 60_000);
  if (minutes >= 1 && minutes <= MAX_DAILY_MINUTES && form.elements.minutes) form.elements.minutes.value = String(minutes);
}

document.addEventListener("input", (event) => {
  if (["startedAt", "endedAt"].includes(event.target.name)) syncEntryDuration(event.target.form);
  if (event.target.id === "project-search") {
    ui.projectSearch = event.target.value;
    const position = event.target.selectionStart;
    render();
    const search = document.querySelector("#project-search"); search?.focus(); search?.setSelectionRange(position, position);
  }
});

document.addEventListener("change", (event) => {
  if (event.target.id === "project-filter") { ui.projectFilter = event.target.value; render(); }
  if (event.target.id === "chart-range") { ui.chartRange = Number(event.target.value); render(); }
});

document.addEventListener("focusout", () => {
  setTimeout(() => applyPendingRemoteState(), 0);
});

window.addEventListener("hashchange", () => { ui.route = getRoute(); ui.menuId = null; ui.notificationsOpen = false; render(); window.scrollTo({ top: 0 }); });
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    location.hash = "#projects";
    ui.route = "projects";
    render();
    requestAnimationFrame(() => document.querySelector("#project-search")?.focus());
    return;
  }
  if (event.key === "Escape") {
    if (ui.modal) closeModal();
    else if (ui.notificationsOpen || ui.menuId) { ui.notificationsOpen = false; ui.menuId = null; render(); }
  }
});

setInterval(() => { if (state.timer.running) updateTimerDisplay(); }, 1000);
setInterval(() => hydrateRemoteState(), SYNC_INTERVAL_MS);
if (NATIVE_UPDATE_TOKEN) {
  setInterval(() => refreshDesktopUpdateStatus(), 5_000);
  refreshDesktopUpdateStatus({ notify: false });
}
render();
if (IS_NATIVE_CLIENT) initializeNativeAuthentication();
else hydrateRemoteState({ announce: true });

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    const isLocalDevelopment = ["localhost", "127.0.0.1"].includes(location.hostname);
    if (isLocalDevelopment) {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => {});
      return;
    }
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
