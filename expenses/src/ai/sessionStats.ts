import { AI_STORAGE_KEYS } from './config';
import type { AiFallbackReason, AiProviderId } from './providerSettings';
import {
  effectiveCooldownUntil,
  getModelCooldowns,
  getModelLimitLog,
} from './storage';

/** Gemini daily quotas reset at midnight Pacific time. */
const GEMINI_QUOTA_TZ = 'America/Los_Angeles';

export interface SessionAiUsage {
  questions: number;
  requests: number;
  tokens: number;
  lastModel: string | null;
}

export interface SessionAiLimit {
  model: string;
  at: number;
  until: number;
  daily: boolean;
  limit?: number;
}

const limits = new Map<string, SessionAiLimit>();
let lastFailed: { model: string; until: number } | null = null;

const pad = (value: number) => String(value).padStart(2, '0');

const zonedParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: GEMINI_QUOTA_TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
  };
};

export function geminiUsageDate(now = new Date()) {
  const parts = zonedParts(now);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/** Next Pacific midnight, when the Gemini daily quota resets. */
export function nextGeminiReset(now = new Date()) {
  const start = geminiUsageDate(now);
  const hour = 60 * 60 * 1000;
  let lo = now.getTime();
  let hi = lo + 36 * hour;
  while (geminiUsageDate(new Date(hi)) === start) hi += 12 * hour;
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if (geminiUsageDate(new Date(mid)) === start) lo = mid;
    else hi = mid;
  }
  return new Date(hi);
}

/** What one device used today. */
interface DeviceUsage extends SessionAiUsage {
  /** Last update (ms), used to pick the most recent model. */
  at: number;
}

/** All devices for one Gemini usage day. Synced in profiles.preferences. */
interface UsageDay {
  date: string;
  devices: Record<string, DeviceUsage>;
}

const DEVICE_ID_KEY = 'aiUsageDevice';

const deviceId = (() => {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return 'this-device';
  }
})();

const num = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;

const cleanDevice = (raw: unknown): DeviceUsage | null => {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  return {
    questions: num(row.questions),
    requests: num(row.requests),
    tokens: num(row.tokens),
    lastModel: typeof row.lastModel === 'string' ? row.lastModel : null,
    at: num(row.at),
  };
};

/** Parses a stored or remote blob. Anything from another day is dropped. */
const cleanUsageDay = (raw: unknown): UsageDay => {
  const today = geminiUsageDate();
  const empty: UsageDay = { date: today, devices: {} };
  if (!raw || typeof raw !== 'object') return empty;
  const data = raw as { date?: unknown; devices?: unknown };
  if (
    data.date !== today ||
    !data.devices ||
    typeof data.devices !== 'object'
  ) {
    return empty;
  }
  const devices: Record<string, DeviceUsage> = {};
  for (const [id, value] of Object.entries(data.devices)) {
    const device = cleanDevice(value);
    if (device) devices[id] = device;
  }
  return { date: today, devices };
};

const loadUsageDay = (): UsageDay => {
  try {
    return cleanUsageDay(
      JSON.parse(localStorage.getItem(AI_STORAGE_KEYS.usage) || 'null')
    );
  } catch {
    return { date: geminiUsageDate(), devices: {} };
  }
};

let usageDay = loadUsageDay();

/** A new Gemini day (midnight Pacific) starts every counter from zero. */
const rollDay = () => {
  const date = geminiUsageDate();
  if (usageDay.date !== date) usageDay = { date, devices: {} };
};

const saveUsage = () => {
  try {
    localStorage.setItem(AI_STORAGE_KEYS.usage, JSON.stringify(usageDay));
  } catch {
    // Storage full: keep the counters in memory only.
  }
  void import('../features/profile/preferencesSync')
    .then((m) => m.schedulePreferencesPush({ aiUsage: usageDay }))
    .catch(() => undefined);
};

const updateThisDevice = (patch: (current: DeviceUsage) => DeviceUsage) => {
  rollDay();
  const current = usageDay.devices[deviceId] || {
    questions: 0,
    requests: 0,
    tokens: 0,
    lastModel: null,
    at: 0,
  };
  usageDay = {
    ...usageDay,
    devices: { ...usageDay.devices, [deviceId]: patch(current) },
  };
  saveUsage();
};

/** A user question or a spoken entry. Counted for today and synced across devices. */
export function recordAiQuestion() {
  updateThisDevice((device) => ({
    ...device,
    questions: device.questions + 1,
    at: Date.now(),
  }));
}

/** One successful Gemini call. Counted for today and synced across devices. */
export function recordAiRequest(model: string, tokens: number) {
  updateThisDevice((device) => ({
    ...device,
    requests: device.requests + 1,
    tokens: device.tokens + Math.max(0, tokens),
    lastModel: model,
    at: Date.now(),
  }));
}

/** Today's usage for profiles.preferences. */
export const readAiUsageForPrefs = (): UsageDay => {
  rollDay();
  return usageDay;
};

/**
 * Merges the usage pulled from another device. Another day is ignored. For
 * this device the larger value wins, so a stale copy never lowers the count.
 */
export const hydrateAiUsageFromPrefs = (raw: unknown): void => {
  rollDay();
  const remote = cleanUsageDay(raw);
  const devices = { ...usageDay.devices };
  const activity = (device: DeviceUsage) =>
    device.questions + device.requests + device.tokens;
  for (const [id, incoming] of Object.entries(remote.devices)) {
    const existing = devices[id];
    if (!existing) {
      devices[id] = incoming;
    } else if (id === deviceId) {
      // Only this device writes its own bucket, so more activity is newer.
      if (activity(incoming) > activity(existing)) devices[id] = incoming;
    } else if (incoming.at >= existing.at) {
      devices[id] = incoming;
    }
  }
  usageDay = { date: usageDay.date, devices };
  try {
    localStorage.setItem(AI_STORAGE_KEYS.usage, JSON.stringify(usageDay));
  } catch {
    // ignore quota
  }
};

const totalUsage = (): SessionAiUsage => {
  rollDay();
  const devices = Object.values(usageDay.devices);
  const latest = devices
    .filter((device) => device.lastModel)
    .sort((a, b) => b.at - a.at)[0];
  return {
    questions: devices.reduce((sum, device) => sum + device.questions, 0),
    requests: devices.reduce((sum, device) => sum + device.requests, 0),
    tokens: devices.reduce((sum, device) => sum + device.tokens, 0),
    lastModel: latest?.lastModel ?? null,
  };
};

/** A model that just hit a limit, so the profile can say it is being skipped. */
export function recordSessionLimit(model: string, limit: SessionAiLimit) {
  limits.set(model, limit);
  lastFailed = { model, until: limit.until };
}

export function getSessionAiStats() {
  const now = Date.now();
  const failed = lastFailed && lastFailed.until > now ? lastFailed : null;
  return {
    usage: totalUsage(),
    lastFailed: failed,
    resetAt: nextGeminiReset().getTime(),
    paused: pausedModels(now),
  };
}

/** Models currently skipped. Session hits are merged with the cooldowns the app already keeps so retry still works. */
function pausedModels(now: number): SessionAiLimit[] {
  const paused = new Map<string, SessionAiLimit>();
  for (const limit of limits.values()) {
    if (limit.until > now) paused.set(limit.model, limit);
  }
  for (const [model, record] of Object.entries(getModelLimitLog())) {
    const until = effectiveCooldownUntil(record);
    if (until <= now) continue;
    const existing = paused.get(model);
    if (!existing || existing.until < until) {
      paused.set(model, {
        model,
        at: record.at,
        until,
        daily: record.daily,
        limit: record.limit,
      });
    }
  }
  for (const [model, until] of Object.entries(getModelCooldowns())) {
    if (until <= now || paused.has(model)) continue;
    paused.set(model, { model, at: until, until, daily: false });
  }
  return [...paused.values()].sort((a, b) => b.at - a.at);
}

/** Cap stored per-request events (synced across devices via preferences). */
const MAX_USAGE_EVENTS = 400;

export type AiUsageEvent = {
  at: number;
  provider: AiProviderId;
  model: string;
  ok: boolean;
  latencyMs: number;
  tokens: number;
  errorKind?: string;
  fallback?: boolean;
  fallbackReason?: AiFallbackReason;
};

const eventKey = (e: AiUsageEvent) =>
  `${e.at}|${e.provider}|${e.model}|${e.ok ? 1 : 0}|${e.latencyMs}|${e.tokens}|${e.errorKind || ''}|${e.fallback ? 1 : 0}|${e.fallbackReason || ''}`;

const cleanUsageEvents = (raw: unknown): AiUsageEvent[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row) => row && typeof row === 'object')
    .map((row) => {
      const r = row as Record<string, unknown>;
      return {
        at: typeof r.at === 'number' ? r.at : 0,
        provider: r.provider as AiProviderId,
        model: typeof r.model === 'string' ? r.model : '',
        ok: r.ok === true,
        latencyMs: typeof r.latencyMs === 'number' ? r.latencyMs : 0,
        tokens: typeof r.tokens === 'number' ? r.tokens : 0,
        errorKind:
          typeof r.errorKind === 'string' ? r.errorKind : undefined,
        fallback: r.fallback === true,
        fallbackReason: r.fallbackReason as AiFallbackReason | undefined,
      };
    })
    .filter((e) => e.at > 0 && e.provider && e.model);
};

const mergeUsageEvents = (
  local: AiUsageEvent[],
  remote: AiUsageEvent[]
): AiUsageEvent[] => {
  const map = new Map<string, AiUsageEvent>();
  for (const e of [...remote, ...local]) {
    map.set(eventKey(e), e);
  }
  return [...map.values()]
    .sort((a, b) => a.at - b.at)
    .slice(-MAX_USAGE_EVENTS);
};

const loadUsageEvents = (): AiUsageEvent[] => {
  try {
    return cleanUsageEvents(
      JSON.parse(localStorage.getItem(AI_STORAGE_KEYS.usageEvents) || '[]')
    );
  } catch {
    return [];
  }
};

let usageEvents = loadUsageEvents();

const persistUsageEventsLocal = () => {
  try {
    localStorage.setItem(
      AI_STORAGE_KEYS.usageEvents,
      JSON.stringify(usageEvents.slice(-MAX_USAGE_EVENTS))
    );
  } catch {
    // ignore
  }
};

const saveUsageEvents = () => {
  persistUsageEventsLocal();
  void import('../features/profile/preferencesSync')
    .then((m) =>
      m.schedulePreferencesPush({
        aiUsageEvents: usageEvents.slice(-MAX_USAGE_EVENTS),
      })
    )
    .catch(() => undefined);
};

export function recordAiUsageEvent(
  event: Omit<AiUsageEvent, 'at'> & { at?: number }
) {
  usageEvents = [
    ...usageEvents,
    { ...event, at: event.at ?? Date.now() },
  ].slice(-MAX_USAGE_EVENTS);
  saveUsageEvents();
}

/** Snapshot for profiles.preferences. */
export const readAiUsageEventsForPrefs = (): AiUsageEvent[] =>
  usageEvents.slice(-MAX_USAGE_EVENTS);

/** Merge events pulled from another device; never drop newer local rows. */
export const hydrateAiUsageEventsFromPrefs = (raw: unknown): void => {
  usageEvents = mergeUsageEvents(usageEvents, cleanUsageEvents(raw));
  persistUsageEventsLocal();
};

export type AiUsageMetrics = {
  total: number;
  success: number;
  failed: number;
  fallbacks: number;
  successRate: number;
  avgLatencyMs: number;
  tokens: number;
  rateLimitErrors: number;
  byProvider: Record<string, number>;
};

const monthStartMs = (now = new Date()) =>
  new Date(now.getFullYear(), now.getMonth(), 1).getTime();

export function getAiUsageMetrics(range: 'today' | 'month' = 'month'): AiUsageMetrics {
  const start =
    range === 'today'
      ? new Date(geminiUsageDate() + 'T00:00:00').getTime()
      : monthStartMs();
  // For "today" use Pacific quota day via event timestamps vs reset — filter by calendar local day as approximation for events.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const from = range === 'today' ? todayStart.getTime() : start;

  const events = usageEvents.filter((e) => e.at >= from);
  const success = events.filter((e) => e.ok);
  const failed = events.filter((e) => !e.ok);
  const fallbacks = events.filter((e) => e.fallback).length;
  const latencySum = success.reduce((s, e) => s + e.latencyMs, 0);
  const tokens = success.reduce((s, e) => s + e.tokens, 0);
  const rateLimitErrors = failed.filter(
    (e) =>
      e.errorKind === 'quota' ||
      e.fallbackReason === 'rate_limit' ||
      e.fallbackReason === 'quota'
  ).length;
  const byProvider: Record<string, number> = {};
  for (const e of success) {
    byProvider[e.provider] = (byProvider[e.provider] || 0) + 1;
  }
  const total = events.length;
  return {
    total,
    success: success.length,
    failed: failed.length,
    fallbacks,
    successRate: total ? (success.length / total) * 100 : 100,
    avgLatencyMs: success.length ? latencySum / success.length : 0,
    tokens,
    rateLimitErrors,
    byProvider,
  };
}
