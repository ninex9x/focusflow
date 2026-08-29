const TIME_ZONE = "America/Sao_Paulo";
const MAX_DAILY_MINUTES = 24 * 60;
const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export class DomainError extends Error {
  constructor(message, statusCode = 422) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function localDateKey(daysAgo = 0) {
  const date = new Date(Date.now() - daysAgo * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function timeZoneParts(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function timeZoneOffsetMinutes(value) {
  const parts = timeZoneParts(value);
  const representedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((representedAsUtc - value.getTime()) / 60_000);
}

function formatBrazilTimestamp(value) {
  const parts = timeZoneParts(value);
  const offsetMinutes = timeZoneOffsetMinutes(value);
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteOffset = Math.abs(offsetMinutes);
  const offset = `${sign}${String(Math.floor(absoluteOffset / 60)).padStart(2, "0")}:${String(absoluteOffset % 60).padStart(2, "0")}`;
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
}

function brazilDateKey(value) {
  const parts = timeZoneParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function parseBrazilDateTime(value, label) {
  const text = String(value || "").trim();
  const localMatch = text.match(LOCAL_DATE_TIME_PATTERN);
  if (localMatch) {
    const [, year, month, day, hour, minute, second = "00"] = localMatch;
    if (!isDateKey(`${year}-${month}-${day}`) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) {
      throw new DomainError(`${label} inválido.`);
    }
    const utcWallClock = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    let instant = new Date(utcWallClock);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      instant = new Date(utcWallClock - timeZoneOffsetMinutes(instant) * 60_000);
    }
    const parts = timeZoneParts(instant);
    if (`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}` !== `${year}-${month}-${day}T${hour}:${minute}:${second}`) {
      throw new DomainError(`${label} não existe no horário de Brasília.`);
    }
    return instant;
  }

  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(text)) {
    throw new DomainError(`${label} inválido.`);
  }
  const instant = new Date(text);
  if (Number.isNaN(instant.getTime())) throw new DomainError(`${label} inválido.`);
  return instant;
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function isDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function offsetDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(fromDateKey, toDateKey) {
  return Math.round((Date.parse(`${toDateKey}T12:00:00Z`) - Date.parse(`${fromDateKey}T12:00:00Z`)) / 86_400_000);
}

function formatNotificationDuration(minutes) {
  const safeMinutes = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  if (!hours) return `${remainingMinutes}min`;
  return remainingMinutes ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
}

function identityProfile(identity = {}) {
  const email = String(identity.email || "").trim().toLowerCase();
  const emailName = email.split("@")[0].replace(/[._-]+/g, " ").trim();
  const fallbackName = emailName
    ? emailName.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase())
    : "Usuário";
  const name = String(identity.name || fallbackName).trim().slice(0, 70) || "Usuário";

  return {
    name,
    email,
    workspace: "Meu Workspace",
    plan: "Plano pessoal",
  };
}

export function createDefaultState(identity = {}) {
  const profile = identityProfile(identity);

  return {
    profile,
    settings: {
      notifications: true,
      timerAlerts: true,
      goalReminders: true,
      riskAlerts: true,
      deadlineAlerts: true,
      weeklySummary: true,
      dailyGoalMinutes: 360,
    },
    projects: [],
    entries: [],
    timer: { projectId: null, subtaskId: null, elapsedSeconds: 0, startedAt: null, sessionStartedAt: null, running: false },
    meta: { version: 8, readNotificationIds: [] },
  };
}

function normalizeSubtasks(value, fallbackCreatedAt = "") {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set();

  return value.slice(0, 200).flatMap((subtask, index) => {
    if (!subtask || typeof subtask !== "object" || typeof subtask.title !== "string") return [];
    const title = subtask.title.trim().slice(0, 120);
    if (!title) return [];
    const candidateId = String(subtask.id || "");
    let id = /^[a-z0-9:_-]{1,160}$/i.test(candidateId) ? candidateId : `subtask-legacy-${index}`;
    if (seenIds.has(id)) id = `${id}-${index}`;
    seenIds.add(id);
    const estimateMinutes = Math.max(0, Math.round(Number(subtask.estimateMinutes) || 0));
    return [{
      id,
      title,
      estimateMinutes,
      completed: Boolean(subtask.completed),
      createdAt: isDateKey(subtask.createdAt) ? subtask.createdAt : (isDateKey(fallbackCreatedAt) ? fallbackCreatedAt : localDateKey()),
    }];
  });
}

export function normalizeState(saved, identity = {}) {
  const fallback = createDefaultState(identity);
  if (!saved?.profile || !Array.isArray(saved.projects) || !Array.isArray(saved.entries)) return fallback;
  const hasLegacyDemoProfile = saved.profile.name === "Alex Morgan"
    && saved.profile.workspace === "Design Studio"
    && saved.profile.plan === "Pro Plan";
  const normalized = {
    ...fallback,
    ...saved,
    profile: { ...fallback.profile, ...saved.profile },
    settings: { ...fallback.settings, ...saved.settings },
    timer: { ...fallback.timer, ...saved.timer },
    meta: { ...fallback.meta, ...saved.meta, version: 8 },
  };

  normalized.projects = normalized.projects.map((project) => ({
    ...project,
    dueDate: isDateKey(project.dueDate) ? project.dueDate : "",
    subtasks: normalizeSubtasks(project.subtasks, project.createdAt),
  }));

  const timerProject = normalized.projects.find((project) => project.id === normalized.timer.projectId);
  if (!timerProject?.subtasks.some((subtask) => subtask.id === normalized.timer.subtaskId)) normalized.timer.subtaskId = null;
  if (normalized.timer.running && !Number.isFinite(Number(normalized.timer.sessionStartedAt))) {
    normalized.timer.sessionStartedAt = Number(normalized.timer.startedAt) || null;
  }

  normalized.meta.readNotificationIds = Array.isArray(normalized.meta.readNotificationIds)
    ? [...new Set(normalized.meta.readNotificationIds.map(String).filter((id) => /^[a-z0-9:_-]{1,160}$/i.test(id)))].slice(-100)
    : [];

  if (identity.email && hasLegacyDemoProfile) normalized.profile = { ...normalized.profile, ...fallback.profile };
  if (identity.email) normalized.profile.email = fallback.profile.email;
  if (!normalized.profile.name) normalized.profile.name = fallback.profile.name;
  return normalized;
}

export function currentTimerSeconds(state) {
  return Number(state.timer.elapsedSeconds || 0) + (state.timer.running && state.timer.startedAt
    ? Math.max(0, Math.floor((Date.now() - Number(state.timer.startedAt)) / 1000))
    : 0);
}

function buildNotifications(state, projects, todayMinutes, dailyGoalMinutes, timerSeconds) {
  if (!state.settings.notifications) return { enabled: false, items: [], unreadCount: 0 };

  const today = localDateKey();
  const items = [];
  const progress = Math.min(100, Math.round((todayMinutes / dailyGoalMinutes) * 100));

  if (state.settings.timerAlerts && state.timer.running && timerSeconds >= 4 * 60 * 60) {
    const timerProject = projects.find((project) => project.id === state.timer.projectId);
    items.push({
      id: `timer:${Number(state.timer.startedAt) || today}`,
      type: "timer",
      title: "Cronômetro rodando há muito tempo",
      message: `${timerProject?.name || "Sua sessão"} está com o cronômetro ativo há ${formatNotificationDuration(Math.floor(timerSeconds / 60))}.`,
      date: today,
      target: "home",
      priority: 100,
    });
  }

  if (state.settings.goalReminders && progress >= 100) {
    items.push({
      id: `goal:${today}:100`,
      type: "goal",
      title: "Meta diária concluída",
      message: `Você concluiu sua meta de ${formatNotificationDuration(dailyGoalMinutes)} hoje.`,
      date: today,
      target: "home",
      priority: 50,
    });
  }

  if (state.settings.riskAlerts) {
    for (const project of projects) {
      if (project.archived || project.status === "completed") continue;
      if (project.actualPercentage >= 100) {
        items.push({
          id: `estimate:${project.id}:100`,
          type: "estimate",
          title: "Estimativa ultrapassada",
          message: `${project.name} atingiu ${project.actualPercentage}% da estimativa planejada.`,
          date: today,
          target: "project",
          projectId: project.id,
          priority: 90,
        });
      } else if (project.actualPercentage >= 80) {
        items.push({
          id: `estimate:${project.id}:80`,
          type: "estimate",
          title: "Projeto perto do limite",
          message: `${project.name} já utilizou ${project.actualPercentage}% da estimativa.`,
          date: today,
          target: "project",
          projectId: project.id,
          priority: 70,
        });
      } else if (project.status === "risk") {
        items.push({
          id: `risk:${project.id}`,
          type: "risk",
          title: "Projeto em risco",
          message: `${project.name} está marcado como risco e precisa de atenção.`,
          date: today,
          target: "project",
          projectId: project.id,
          priority: 75,
        });
      }
    }
  }

  if (state.settings.deadlineAlerts) {
    for (const project of projects) {
      if (project.archived || project.status === "completed" || !project.dueDate) continue;
      const daysUntilDeadline = daysBetween(today, project.dueDate);
      if (daysUntilDeadline < 0) {
        const overdueDays = Math.abs(daysUntilDeadline);
        items.push({
          id: `deadline:${project.id}:${project.dueDate}:overdue`,
          type: "deadline",
          title: "Prazo atrasado",
          message: `${project.name} está atrasado há ${overdueDays} dia${overdueDays === 1 ? "" : "s"}.`,
          date: project.dueDate,
          target: "project",
          projectId: project.id,
          priority: 95,
        });
      } else if (daysUntilDeadline <= 1) {
        items.push({
          id: `deadline:${project.id}:${project.dueDate}:soon`,
          type: "deadline",
          title: daysUntilDeadline === 0 ? "Prazo vence hoje" : "Prazo vence amanhã",
          message: `${project.name} precisa de atenção para cumprir o prazo.`,
          date: project.dueDate,
          target: "project",
          projectId: project.id,
          priority: 80,
        });
      }
    }
  }

  if (state.settings.weeklySummary) {
    const dayOfWeek = new Date(`${today}T12:00:00Z`).getUTCDay();
    const currentWeekStart = offsetDateKey(today, -((dayOfWeek + 6) % 7));
    const previousWeekStart = offsetDateKey(currentWeekStart, -7);
    const previousWeekEnd = offsetDateKey(currentWeekStart, -1);
    const weeklyEntries = state.entries.filter((entry) => entry.date >= previousWeekStart && entry.date <= previousWeekEnd);
    const weeklyMinutes = weeklyEntries.reduce((sum, entry) => sum + Number(entry.minutes || 0), 0);
    if (weeklyMinutes > 0) {
      const projectTotals = new Map();
      for (const entry of weeklyEntries) projectTotals.set(entry.projectId, (projectTotals.get(entry.projectId) || 0) + Number(entry.minutes || 0));
      const topProjectId = [...projectTotals].sort((a, b) => b[1] - a[1])[0]?.[0];
      const topProject = projects.find((project) => project.id === topProjectId);
      items.push({
        id: `weekly:${previousWeekStart}`,
        type: "weekly",
        title: "Resumo da semana anterior",
        message: `${formatNotificationDuration(weeklyMinutes)} em ${weeklyEntries.length} sess${weeklyEntries.length === 1 ? "ão" : "ões"}${topProject ? ` · destaque: ${topProject.name}` : ""}.`,
        date: previousWeekEnd,
        target: "stats",
        priority: 40,
      });
    }
  }

  const readIds = new Set(state.meta.readNotificationIds);
  const decorated = items
    .sort((first, second) => second.priority - first.priority || second.date.localeCompare(first.date))
    .slice(0, 20)
    .map(({ priority, ...item }) => ({ ...item, read: readIds.has(item.id) }));
  return {
    enabled: true,
    items: decorated,
    unreadCount: decorated.filter((item) => !item.read).length,
  };
}

export function buildClientState(input, identity = {}) {
  const state = normalizeState(input, identity);
  const loggedByProject = new Map();
  const loggedBySubtask = new Map();
  const countByProject = new Map();
  const recordedMinutesByDate = new Map();
  const projectMap = new Map(state.projects.map((project) => [project.id, project]));

  for (const entry of state.entries) {
    const entryMinutes = Math.max(0, Number(entry.minutes) || 0);
    loggedByProject.set(entry.projectId, (loggedByProject.get(entry.projectId) || 0) + entryMinutes);
    countByProject.set(entry.projectId, (countByProject.get(entry.projectId) || 0) + 1);
    recordedMinutesByDate.set(entry.date, (recordedMinutesByDate.get(entry.date) || 0) + entryMinutes);
    if (entry.subtaskId) {
      const key = `${entry.projectId}:${entry.subtaskId}`;
      loggedBySubtask.set(key, (loggedBySubtask.get(key) || 0) + entryMinutes);
    }
  }

  const projects = state.projects.map((project) => {
    const loggedMinutes = loggedByProject.get(project.id) || 0;
    const actualPercentage = Math.round((loggedMinutes / Math.max(1, Number(project.estimateMinutes))) * 100);
    return {
      ...project,
      subtasks: project.subtasks.map((subtask) => {
        const loggedMinutes = loggedBySubtask.get(`${project.id}:${subtask.id}`) || 0;
        return {
          ...subtask,
          loggedMinutes,
          actualPercentage: Math.round((loggedMinutes / Math.max(1, Number(subtask.estimateMinutes))) * 100),
        };
      }),
      loggedMinutes,
      entryCount: countByProject.get(project.id) || 0,
      percentage: Math.min(100, actualPercentage),
      actualPercentage,
    };
  });
  const decoratedProjectMap = new Map(projects.map((project) => [project.id, project]));
  const entries = state.entries.map((entry) => {
    const project = decoratedProjectMap.get(entry.projectId);
    const subtask = project?.subtasks.find((item) => item.id === entry.subtaskId);
    return {
      ...entry,
      subtaskTitle: entry.subtaskTitle || subtask?.title || "",
      projectName: project?.name || "Projeto removido",
      projectClient: project?.client || "",
      projectColor: project?.color || "#3b82f6",
    };
  });
  const timerSeconds = currentTimerSeconds(state);
  const timerMinutes = Math.floor(timerSeconds / 60);
  const today = localDateKey();
  const rawTodayMinutes = (recordedMinutesByDate.get(today) || 0) + timerMinutes;
  const todayMinutes = Math.min(MAX_DAILY_MINUTES, rawTodayMinutes);
  const dailyGoalMinutes = Math.max(1, Number(state.settings.dailyGoalMinutes || 0));
  const recentEntries = [...entries].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 6);
  const notifications = buildNotifications(state, projects, todayMinutes, dailyGoalMinutes, timerSeconds);
  const analytics = {};

  for (const range of [7, 30]) {
    const days = Array.from({ length: range }, (_, index) => localDateKey(range - 1 - index));
    const rawValues = days.map((date) => recordedMinutesByDate.get(date) || 0);
    if (state.timer.running) rawValues[rawValues.length - 1] += timerMinutes;
    const overLimitDays = days.flatMap((date, index) => rawValues[index] > MAX_DAILY_MINUTES
      ? [{ date, totalMinutes: rawValues[index], excessMinutes: rawValues[index] - MAX_DAILY_MINUTES }]
      : []);
    const values = rawValues.map((minutes) => Math.min(MAX_DAILY_MINUTES, minutes));
    const total = values.reduce((sum, minutes) => sum + minutes, 0);
    const previousDays = Array.from({ length: range }, (_, index) => localDateKey(range * 2 - 1 - index));
    const previousTotal = previousDays.reduce((sum, date) => sum + Math.min(MAX_DAILY_MINUTES, recordedMinutesByDate.get(date) || 0), 0);
    const projectTotals = projects.map((project) => ({
      project,
      minutes: Math.min(total, state.entries.filter((entry) => days.includes(entry.date) && entry.projectId === project.id).reduce((sum, entry) => sum + Math.max(0, Number(entry.minutes) || 0), 0)),
    })).sort((a, b) => b.minutes - a.minutes);

    analytics[range] = {
      range,
      days,
      values,
      total,
      averageMinutes: total / range,
      delta: previousTotal ? Math.round(((total - previousTotal) / previousTotal) * 100) : 100,
      topProject: projectTotals[0] || null,
      maxMinutes: Math.max(1, ...values),
      overLimitDays,
    };
  }

  return {
    ...state,
    projects,
    entries,
    summary: {
      todayMinutes,
      rawTodayMinutes,
      isTodayOverLimit: rawTodayMinutes > MAX_DAILY_MINUTES,
      dailyGoalMinutes,
      progress: Math.min(100, Math.round((todayMinutes / dailyGoalMinutes) * 100)),
      timerSeconds,
      recentEntries,
    },
    notifications,
    analytics,
  };
}

function requiredText(value, label, maxLength) {
  const text = String(value || "").trim();
  if (!text) throw new DomainError(`${label} é obrigatório.`);
  if (text.length > maxLength) throw new DomainError(`${label} excede ${maxLength} caracteres.`);
  return text;
}

function optionalDateKey(value, label) {
  const dateKey = String(value || "").trim();
  if (!dateKey) return "";
  if (!isDateKey(dateKey)) throw new DomainError(`${label} inválido.`);
  return dateKey;
}

function requiredDateKey(value, label) {
  const dateKey = String(value || "").trim();
  if (!dateKey) throw new DomainError(`${label} é obrigatória.`);
  if (!isDateKey(dateKey)) throw new DomainError(`${label} inválida.`);
  return dateKey;
}

function projectById(state, id) {
  const project = state.projects.find((item) => item.id === id);
  if (!project) throw new DomainError("Projeto não encontrado.", 404);
  return project;
}

function subtaskById(project, id) {
  const subtask = project.subtasks.find((item) => item.id === id);
  if (!subtask) throw new DomainError("Subtarefa não encontrada.", 404);
  return subtask;
}

function entryById(state, id) {
  const entry = state.entries.find((item) => item.id === id);
  if (!entry) throw new DomainError("Lançamento não encontrado.", 404);
  return entry;
}

function validatedEntryData(state, payload, ignoredEntryId = null) {
  const hasStart = String(payload.startedAt || "").trim().length > 0;
  const hasEnd = String(payload.endedAt || "").trim().length > 0;
  if (hasStart !== hasEnd) throw new DomainError("Informe os horários de início e fim.");

  let timing = null;
  if (hasStart) {
    const startedAt = parseBrazilDateTime(payload.startedAt, "Horário de início");
    const endedAt = parseBrazilDateTime(payload.endedAt, "Horário de fim");
    const startDate = brazilDateKey(startedAt);
    const endDate = brazilDateKey(endedAt);
    const intervalMinutes = Math.ceil((endedAt.getTime() - startedAt.getTime()) / 60_000);
    if (intervalMinutes < 1) throw new DomainError("O horário de fim deve ser posterior ao início.");
    if (intervalMinutes > MAX_DAILY_MINUTES) throw new DomainError("Uma sessão não pode ultrapassar 24h.", 409);
    if (startDate !== endDate) {
      throw new DomainError("O início e o fim devem estar no mesmo dia de Brasília. Divida sessões que atravessam a meia-noite.");
    }
    timing = { startedAt, endedAt, intervalMinutes, date: startDate };
  }

  const minutes = timing && String(payload.minutes ?? "").trim() === "" ? timing.intervalMinutes : Number(payload.minutes);
  if (!Number.isInteger(minutes) || minutes < 1) throw new DomainError("Duração inválida.");
  if (minutes > MAX_DAILY_MINUTES) throw new DomainError("Uma sessão não pode ultrapassar 24h. Corrija a duração antes de registrar.", 409);
  if (timing && minutes > timing.intervalMinutes) {
    throw new DomainError("A duração trabalhada não pode ser maior que o intervalo entre início e fim.");
  }
  const date = timing?.date || requiredDateKey(payload.date, "Data");

  if (timing) {
    const overlappingEntry = state.entries.find((entry) => {
      if (entry.id === ignoredEntryId || !entry.startedAt || !entry.endedAt) return false;
      const existingStart = Date.parse(entry.startedAt);
      const existingEnd = Date.parse(entry.endedAt);
      return Number.isFinite(existingStart) && Number.isFinite(existingEnd)
        && timing.startedAt.getTime() < existingEnd
        && timing.endedAt.getTime() > existingStart;
    });
    if (overlappingEntry) {
      throw new DomainError("Este horário se sobrepõe a outro lançamento. Corrija o início ou o fim.", 409);
    }
  }

  const recordedMinutes = state.entries
    .filter((entry) => entry.id !== ignoredEntryId && entry.date === date)
    .reduce((sum, entry) => sum + Math.max(0, Number(entry.minutes) || 0), 0);
  if (recordedMinutes + minutes > MAX_DAILY_MINUTES) {
    const availableMinutes = Math.max(0, MAX_DAILY_MINUTES - recordedMinutes);
    throw new DomainError(`Um dia não pode ultrapassar 24h. Restam ${formatNotificationDuration(availableMinutes)} em ${date}.`, 409);
  }
  return {
    title: requiredText(payload.title, "Descrição", 100),
    minutes,
    date,
    ...(timing ? {
      startedAt: formatBrazilTimestamp(timing.startedAt),
      endedAt: formatBrazilTimestamp(timing.endedAt),
      timeZone: TIME_ZONE,
    } : {}),
  };
}

export function applyAction(input, action, payload = {}, identity = {}) {
  let state = normalizeState(structuredClone(input), identity);

  switch (action) {
    case "timer-toggle": {
      if (!state.timer.projectId) state.timer.projectId = state.projects.find((project) => !project.archived)?.id || null;
      if (!state.timer.projectId) throw new DomainError("Crie um projeto antes de iniciar o cronômetro.", 409);
      if (state.timer.running) {
        state.timer.elapsedSeconds = currentTimerSeconds(state);
        state.timer.startedAt = null;
        state.timer.running = false;
      } else {
        const project = projectById(state, state.timer.projectId);
        if (project.archived) throw new DomainError("Não é possível usar um projeto arquivado.", 409);
        if (state.timer.subtaskId) subtaskById(project, state.timer.subtaskId);
        const now = Date.now();
        if (!Number(state.timer.elapsedSeconds || 0)) state.timer.sessionStartedAt = now;
        else if (!Number.isFinite(Number(state.timer.sessionStartedAt))) state.timer.sessionStartedAt = now - Number(state.timer.elapsedSeconds || 0) * 1000;
        state.timer.startedAt = now;
        state.timer.running = true;
      }
      break;
    }
    case "timer-stop": {
      const elapsed = currentTimerSeconds(state);
      if (elapsed < 1) throw new DomainError("Não há uma sessão em andamento.", 409);
      const project = projectById(state, state.timer.projectId);
      const subtask = state.timer.subtaskId ? project.subtasks.find((item) => item.id === state.timer.subtaskId) : null;
      const endedAt = Date.now();
      const derivedStartedAt = endedAt - elapsed * 1000;
      const recordedSessionStart = Number(state.timer.sessionStartedAt);
      const startedAt = Number.isFinite(recordedSessionStart) && recordedSessionStart <= derivedStartedAt
        ? recordedSessionStart
        : derivedStartedAt;
      const legacyCorrection = !payload.startedAt && !payload.endedAt && (payload.minutes != null || payload.date);
      const entryData = validatedEntryData(state, {
        title: payload.title || "Sessão de foco",
        minutes: payload.minutes ?? Math.max(1, Math.round(elapsed / 60)),
        date: payload.date || localDateKey(),
        ...(!legacyCorrection ? {
          startedAt: payload.startedAt || formatBrazilTimestamp(new Date(startedAt)),
          endedAt: payload.endedAt || formatBrazilTimestamp(new Date(endedAt)),
        } : {}),
      });
      state.entries.push({ id: uid("entry"), projectId: project.id, subtaskId: subtask?.id || null, subtaskTitle: subtask?.title || "", ...entryData, source: "timer" });
      state.timer = { projectId: project.id, subtaskId: subtask?.id || null, elapsedSeconds: 0, startedAt: null, sessionStartedAt: null, running: false };
      break;
    }
    case "timer-project": {
      const project = projectById(state, payload.id);
      if (project.archived) throw new DomainError("Não é possível usar um projeto arquivado.", 409);
      const subtaskId = String(payload.subtaskId || "") || null;
      if (subtaskId) subtaskById(project, subtaskId);
      if (state.timer.running && (state.timer.projectId !== project.id || state.timer.subtaskId !== subtaskId)) throw new DomainError("Pause o cronômetro antes de trocar de projeto ou subtarefa.", 409);
      state.timer.projectId = project.id;
      state.timer.subtaskId = subtaskId;
      break;
    }
    case "project-save": {
      const projectData = {
        name: requiredText(payload.name, "Nome do projeto", 80),
        client: String(payload.client || "").trim().slice(0, 80),
        status: ["active", "ontrack", "risk", "completed", "planned"].includes(payload.status) ? payload.status : "planned",
        estimateMinutes: Math.round(Number(payload.estimate) * 60),
        dueDate: optionalDateKey(payload.dueDate, "Prazo"),
        color: /^#[0-9a-f]{6}$/i.test(payload.color) ? payload.color : "#3b82f6",
      };
      if (!Number.isFinite(projectData.estimateMinutes) || projectData.estimateMinutes < 30 || projectData.estimateMinutes > 600_000) throw new DomainError("Estimativa inválida.");
      if (payload.id) {
        const project = projectById(state, payload.id);
        const allocatedMinutes = project.subtasks.reduce((sum, subtask) => sum + subtask.estimateMinutes, 0);
        if (projectData.estimateMinutes < allocatedMinutes) {
          throw new DomainError(`A estimativa não pode ser menor que as ${formatNotificationDuration(allocatedMinutes)} distribuídas nas subtarefas.`);
        }
        Object.assign(project, projectData);
      } else {
        state.projects.push({ id: uid("project"), ...projectData, subtasks: [], archived: false, createdAt: localDateKey() });
      }
      break;
    }
    case "subtask-save": {
      const project = projectById(state, payload.projectId);
      const existing = payload.id ? subtaskById(project, payload.id) : null;
      if (!existing && project.subtasks.length >= 200) throw new DomainError("Este projeto atingiu o limite de 200 subtarefas.", 409);
      const estimateMinutes = Math.round(Number(payload.estimate) * 60);
      if (!Number.isFinite(estimateMinutes) || estimateMinutes < 15 || estimateMinutes > 600_000) {
        throw new DomainError("Estimativa da subtarefa inválida.");
      }
      const allocatedMinutes = project.subtasks.reduce((sum, subtask) => sum + (subtask === existing ? 0 : subtask.estimateMinutes), 0);
      if (allocatedMinutes + estimateMinutes > project.estimateMinutes) {
        const availableMinutes = Math.max(0, project.estimateMinutes - allocatedMinutes);
        throw new DomainError(`Restam ${formatNotificationDuration(availableMinutes)} para distribuir neste projeto.`);
      }
      const subtaskData = {
        title: requiredText(payload.title, "Título da subtarefa", 120),
        estimateMinutes,
      };
      if (existing) Object.assign(existing, subtaskData);
      else project.subtasks.push({ id: uid("subtask"), ...subtaskData, completed: false, createdAt: localDateKey() });
      break;
    }
    case "subtask-set-completed": {
      const project = projectById(state, payload.projectId);
      subtaskById(project, payload.id).completed = Boolean(payload.completed);
      break;
    }
    case "subtask-delete": {
      const project = projectById(state, payload.projectId);
      const subtask = subtaskById(project, payload.id);
      if (state.timer.running && state.timer.projectId === project.id && state.timer.subtaskId === subtask.id) {
        throw new DomainError("Finalize o cronômetro antes de excluir esta subtarefa.", 409);
      }
      project.subtasks = project.subtasks.filter((item) => item.id !== subtask.id);
      if (state.timer.projectId === project.id && state.timer.subtaskId === subtask.id) state.timer.subtaskId = null;
      break;
    }
    case "project-archive": {
      const project = projectById(state, payload.id);
      if (state.timer.projectId === project.id && state.timer.running) throw new DomainError("Finalize o cronômetro antes de arquivar este projeto.", 409);
      project.archived = !project.archived;
      break;
    }
    case "project-delete": {
      const project = projectById(state, payload.id);
      if (state.timer.projectId === project.id && state.timer.running) throw new DomainError("Finalize o cronômetro antes de excluir este projeto.", 409);
      state.projects = state.projects.filter((item) => item.id !== project.id);
      state.entries = state.entries.filter((entry) => entry.projectId !== project.id);
      if (state.timer.projectId === project.id) state.timer = { projectId: state.projects.find((item) => !item.archived)?.id || null, subtaskId: null, elapsedSeconds: 0, startedAt: null, sessionStartedAt: null, running: false };
      break;
    }
    case "entry-create": {
      const project = projectById(state, payload.projectId);
      if (project.archived) throw new DomainError("Não é possível registrar tempo em projeto arquivado.", 409);
      state.entries.push({ id: uid("entry"), projectId: project.id, ...validatedEntryData(state, payload), source: "manual" });
      break;
    }
    case "entry-update": {
      const entry = entryById(state, payload.id);
      projectById(state, entry.projectId);
      Object.assign(entry, {
        ...validatedEntryData(state, payload, entry.id),
        subtaskId: entry.subtaskId || null,
        subtaskTitle: entry.subtaskTitle || "",
      });
      break;
    }
    case "entry-delete": {
      const entry = entryById(state, payload.id);
      state.entries = state.entries.filter((item) => item.id !== entry.id);
      break;
    }
    case "goal-save": {
      const hours = Number(payload.hours);
      if (!Number.isFinite(hours) || hours < 0.5 || hours > 24) throw new DomainError("Meta diária inválida.");
      state.settings.dailyGoalMinutes = Math.round(hours * 60);
      break;
    }
    case "profile-save":
      state.profile = {
        ...state.profile,
        name: requiredText(payload.name, "Nome", 70),
        email: identity.email ? identityProfile(identity).email : requiredText(payload.email, "E-mail", 120),
        workspace: requiredText(payload.workspace, "Workspace", 70),
      };
      break;
    case "notifications-save":
      for (const setting of ["notifications", "timerAlerts", "goalReminders", "riskAlerts", "deadlineAlerts", "weeklySummary"]) {
        if (Object.hasOwn(payload, setting)) state.settings[setting] = Boolean(payload[setting]);
      }
      break;
    case "notifications-read": {
      const activeIds = new Set(buildClientState(state, identity).notifications.items.map((item) => item.id));
      const requestedIds = Array.isArray(payload.ids) ? payload.ids : [...activeIds];
      const readIds = requestedIds.map(String).filter((id) => activeIds.has(id));
      state.meta.readNotificationIds = [...new Set([...state.meta.readNotificationIds, ...readIds])].slice(-100);
      break;
    }
    case "reset":
      state = createDefaultState(identity);
      break;
    default:
      throw new DomainError("Ação não reconhecida.", 404);
  }

  return state;
}

export function exportState(state, format, identity = {}) {
  const normalized = normalizeState(state, identity);
  if (format === "json") {
    return { content: JSON.stringify(normalized, null, 2), contentType: "application/json", filename: `focusflow-backup-${localDateKey()}.json` };
  }
  if (format === "csv") {
    const projects = new Map(normalized.projects.map((project) => [project.id, project]));
    const rows = [["Data", "Início", "Fim", "Fuso horário", "Projeto", "Cliente", "Descrição", "Minutos", "Horas"], ...normalized.entries.map((entry) => {
      const project = projects.get(entry.projectId);
      return [entry.date, entry.startedAt || "", entry.endedAt || "", entry.timeZone || "", project?.name || "Projeto removido", project?.client || "", entry.title, entry.minutes, (Number(entry.minutes) / 60).toFixed(2)];
    })];
    const content = "\ufeff" + rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    return { content, contentType: "text/csv; charset=utf-8", filename: `focusflow-registros-${localDateKey()}.csv` };
  }
  throw new DomainError("Formato de exportação inválido.");
}
