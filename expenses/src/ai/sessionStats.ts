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

interface SessionDay extends SessionAiUsage {
  date: string;
}

const emptyDay = (date: string): SessionDay => ({
  date,
  questions: 0,
  requests: 0,
  tokens: 0,
  lastModel: null,
});

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

let usage = emptyDay(geminiUsageDate());

const rollDay = () => {
  const date = geminiUsageDate();
  if (usage.date !== date) usage = emptyDay(date);
};

/** A user question or a spoken entry. Kept in memory for this visit only. */
export function recordAiQuestion() {
  rollDay();
  usage = { ...usage, questions: usage.questions + 1 };
}

/** One successful Gemini call. Kept in memory for this visit only. */
export function recordAiRequest(model: string, tokens: number) {
  rollDay();
  usage = {
    ...usage,
    requests: usage.requests + 1,
    tokens: usage.tokens + Math.max(0, tokens),
    lastModel: model,
  };
}

/** A model that just hit a limit, so the profile can say it is being skipped. */
export function recordSessionLimit(model: string, limit: SessionAiLimit) {
  limits.set(model, limit);
  lastFailed = { model, until: limit.until };
}

export function getSessionAiStats() {
  rollDay();
  const now = Date.now();
  const failed = lastFailed && lastFailed.until > now ? lastFailed : null;
  return {
    usage: {
      questions: usage.questions,
      requests: usage.requests,
      tokens: usage.tokens,
      lastModel: usage.lastModel,
    },
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
