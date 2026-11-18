import { AI_STORAGE_KEYS } from './config';
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
