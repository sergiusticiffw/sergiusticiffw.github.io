import "server-only";

import { createClient } from "@/lib/supabase/server";

export const GEMINI_QUOTA_TZ = "America/Los_Angeles";

export type AiUsageDay = {
  date: string;
  questions: number;
  requests: number;
  tokens: number;
  lastModel: string | null;
  updatedAt: string | null;
};

export type AiModelLimit = {
  model: string;
  at: number;
  until: number;
  status: number;
  daily: boolean;
  retryAfterSeconds?: number;
  quotaId?: string;
  quotaLimit?: number;
};

type MemoryDay = AiUsageDay;

const SKIP_MS = 10 * 60_000;
const memoryUsage = new Map<string, MemoryDay>();
const memoryLimits = new Map<string, Map<string, AiModelLimit>>();
const unavailableModels = new Set<string>();
const modelCooldown = new Map<string, number>();
let lastFailed: { model: string; until: number } | null = null;

export function rememberSkip(model: string) {
  lastFailed = { model, until: Date.now() + SKIP_MS };
}

export function markModelUnavailable(model: string) {
  unavailableModels.add(model);
}

export function isModelUnavailable(model: string) {
  return unavailableModels.has(model);
}

export function setModelCooldown(model: string, until: number) {
  modelCooldown.set(model, until);
}

export function getModelCooldown(model: string) {
  return modelCooldown.get(model) ?? 0;
}

export function peekLastFailed() {
  if (!lastFailed) {
    return null;
  }
  if (lastFailed.until < Date.now()) {
    lastFailed = null;
    return null;
  }
  return lastFailed;
}

export function getAiRuntime() {
  const now = Date.now();
  const failed = peekLastFailed();
  return {
    lastFailed: failed ? { model: failed.model, until: failed.until } : null,
    cooldowns: Object.fromEntries(
      [...modelCooldown.entries()].filter(([, until]) => until > now),
    ) as Record<string, number>,
    unavailable: [...unavailableModels],
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

export function geminiUsageDate(now = new Date()) {
  const parts = zonedParts(now, GEMINI_QUOTA_TZ);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function nextGeminiReset(now = new Date()) {
  const start = geminiUsageDate(now);
  const hour = 60 * 60 * 1000;
  let lo = now.getTime();
  let hi = lo + 36 * hour;
  while (geminiUsageDate(new Date(hi)) === start) {
    hi += 12 * hour;
  }
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    if (geminiUsageDate(new Date(mid)) === start) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return new Date(hi);
}

function memoryKey(familyId: string, date = geminiUsageDate()) {
  return `${familyId}:${date}`;
}

function emptyDay(date: string): AiUsageDay {
  return {
    date,
    questions: 0,
    requests: 0,
    tokens: 0,
    lastModel: null,
    updatedAt: null,
  };
}

function missingTable(code?: string) {
  return code === "42P01" || code === "PGRST205" || code === "PGRST204";
}

function parseDuration(value: string) {
  const match = value
    .trim()
    .match(/^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?$/i);
  if (!match) {
    return undefined;
  }
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? Math.round(total) : undefined;
}

export function parseRetryDelay(
  details: { retryDelay?: string }[] | undefined,
  message: string,
) {
  const fromDetails = details?.find((detail) => typeof detail.retryDelay === "string")
    ?.retryDelay;
  if (fromDetails) {
    const seconds = parseDuration(fromDetails);
    if (seconds !== undefined) {
      return seconds;
    }
  }
  const fromMessage = message.match(/retry in ([0-9.hms]+)/i)?.[1];
  return fromMessage ? parseDuration(fromMessage) : undefined;
}

export function isDailyQuota(
  message: string,
  details: { violations?: { quotaId?: string; quotaMetric?: string }[] }[] | undefined,
) {
  if (/per ?day/i.test(message)) {
    return true;
  }
  return Boolean(
    details?.some((detail) =>
      detail.violations?.some((violation) =>
        /PerDay/i.test(`${violation.quotaId ?? ""}${violation.quotaMetric ?? ""}`),
      ),
    ),
  );
}

export function quotaFromDetails(
  message: string,
  details:
    | {
        violations?: {
          quotaId?: string;
          quotaMetric?: string;
          quotaValue?: string | number;
        }[];
      }[]
    | undefined,
) {
  const violations = details?.flatMap((detail) => detail.violations ?? []) ?? [];
  const daily = violations.find((violation) =>
    /PerDay/i.test(`${violation.quotaId ?? ""}${violation.quotaMetric ?? ""}`),
  );
  const violation =
    daily ?? violations.find((item) => item.quotaId || item.quotaMetric);
  const fromMessage = message.match(/limit:\s*(\d+)/i)?.[1];
  const quotaLimit = Number(violation?.quotaValue ?? fromMessage);
  return {
    quotaId: violation?.quotaId || violation?.quotaMetric,
    quotaLimit: Number.isFinite(quotaLimit) && quotaLimit > 0 ? quotaLimit : undefined,
  };
}

function readMemory(familyId: string) {
  const date = geminiUsageDate();
  const stored = memoryUsage.get(memoryKey(familyId, date));
  if (stored?.date === date) {
    return stored;
  }
  const fresh = emptyDay(date);
  memoryUsage.set(memoryKey(familyId, date), fresh);
  return fresh;
}

function writeMemory(familyId: string, day: AiUsageDay) {
  memoryUsage.set(memoryKey(familyId, day.date), day);
}

function familyLimits(familyId: string) {
  const existing = memoryLimits.get(familyId);
  if (existing) {
    return existing;
  }
  const created = new Map<string, AiModelLimit>();
  memoryLimits.set(familyId, created);
  return created;
}

export function getMemoryUsage(familyId: string) {
  return readMemory(familyId);
}

export function getMemoryLimits(familyId: string) {
  const now = Date.now();
  return [...familyLimits(familyId).values()].filter((limit) => limit.until > now);
}

export async function recordAiQuestion(familyId: string) {
  const current = readMemory(familyId);
  const next = {
    ...current,
    questions: current.questions + 1,
    updatedAt: new Date().toISOString(),
  };
  writeMemory(familyId, next);
  await persistUsage(familyId, { questions: 1 });
}

export async function recordAiRequest(input: {
  familyId: string;
  model: string;
  tokens: number;
}) {
  const current = readMemory(input.familyId);
  const next = {
    ...current,
    requests: current.requests + 1,
    tokens: current.tokens + Math.max(0, input.tokens),
    lastModel: input.model,
    updatedAt: new Date().toISOString(),
  };
  writeMemory(input.familyId, next);
  await persistUsage(input.familyId, {
    requests: 1,
    tokens: Math.max(0, input.tokens),
    lastModel: input.model,
  });
}

export async function recordAiLimit(familyId: string, limit: AiModelLimit) {
  familyLimits(familyId).set(limit.model, limit);
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("ai_model_limits").upsert({
      family_id: familyId,
      model: limit.model,
      hit_at: new Date(limit.at).toISOString(),
      until: new Date(limit.until).toISOString(),
      status: limit.status,
      daily: limit.daily,
      retry_after_seconds: limit.retryAfterSeconds ?? null,
      quota_id: limit.quotaId ?? null,
      quota_limit: limit.quotaLimit ?? null,
    });
    if (error && !missingTable(error.code)) {
      console.error("recordAiLimit", error.code);
    }
  } catch (error) {
    console.error("recordAiLimit", error instanceof Error ? error.name : "unknown");
  }
}

async function persistUsage(
  familyId: string,
  delta: {
    questions?: number;
    requests?: number;
    tokens?: number;
    lastModel?: string;
  },
) {
  try {
    const supabase = await createClient();
    const date = geminiUsageDate();
    const { data, error } = await supabase
      .from("ai_usage_days")
      .select("questions, requests, tokens, last_model")
      .eq("family_id", familyId)
      .eq("usage_date", date)
      .maybeSingle();
    if (error) {
      if (!missingTable(error.code)) {
        console.error("persistAiUsage", error.code);
      }
      return;
    }

    const row = data as {
      questions: number;
      requests: number;
      tokens: number;
      last_model: string | null;
    } | null;
    const payload = {
      family_id: familyId,
      usage_date: date,
      questions: (row?.questions ?? 0) + (delta.questions ?? 0),
      requests: (row?.requests ?? 0) + (delta.requests ?? 0),
      tokens: (row?.tokens ?? 0) + (delta.tokens ?? 0),
      last_model: delta.lastModel ?? row?.last_model ?? null,
      updated_at: new Date().toISOString(),
    };

    const saved = row
      ? await supabase
          .from("ai_usage_days")
          .update(payload)
          .eq("family_id", familyId)
          .eq("usage_date", date)
      : await supabase.from("ai_usage_days").insert(payload);

    if (saved.error && !missingTable(saved.error.code)) {
      console.error("persistAiUsage", saved.error.code);
    }
  } catch (error) {
    console.error("persistAiUsage", error instanceof Error ? error.name : "unknown");
  }
}

export async function loadAiUsage(familyId: string) {
  const date = geminiUsageDate();
  const memory = readMemory(familyId);
  const limits = new Map(
    getMemoryLimits(familyId).map((limit) => [limit.model, limit]),
  );

  try {
    const supabase = await createClient();
    const [usageResult, limitsResult] = await Promise.all([
      supabase
        .from("ai_usage_days")
        .select("usage_date, questions, requests, tokens, last_model, updated_at")
        .eq("family_id", familyId)
        .eq("usage_date", date)
        .maybeSingle(),
      supabase
        .from("ai_model_limits")
        .select(
          "model, hit_at, until, status, daily, retry_after_seconds, quota_id, quota_limit",
        )
        .eq("family_id", familyId),
    ]);

    if (usageResult.error && !missingTable(usageResult.error.code)) {
      console.error("loadAiUsage", usageResult.error.code);
    }
    if (limitsResult.error && !missingTable(limitsResult.error.code)) {
      console.error("loadAiLimits", limitsResult.error.code);
    }

    const stored = usageResult.data as {
      usage_date: string;
      questions: number;
      requests: number;
      tokens: number;
      last_model: string | null;
      updated_at: string;
    } | null;

    const usage: AiUsageDay = stored
      ? {
          date: stored.usage_date,
          questions: Math.max(stored.questions, memory.questions),
          requests: Math.max(stored.requests, memory.requests),
          tokens: Math.max(stored.tokens, memory.tokens),
          lastModel: memory.lastModel ?? stored.last_model,
          updatedAt: memory.updatedAt ?? stored.updated_at,
        }
      : memory;

    const now = Date.now();
    for (const row of (limitsResult.data ?? []) as {
      model: string;
      hit_at: string;
      until: string;
      status: number;
      daily: boolean;
      retry_after_seconds: number | null;
      quota_id: string | null;
      quota_limit: number | null;
    }[]) {
      const until = new Date(row.until).getTime();
      if (until <= now) {
        continue;
      }
      const existing = limits.get(row.model);
      if (!existing || existing.until < until) {
        limits.set(row.model, {
          model: row.model,
          at: new Date(row.hit_at).getTime(),
          until,
          status: row.status,
          daily: row.daily,
          retryAfterSeconds: row.retry_after_seconds ?? undefined,
          quotaId: row.quota_id ?? undefined,
          quotaLimit: row.quota_limit ?? undefined,
        });
      }
    }

    return withRuntime(usage, [...limits.values()]);
  } catch (error) {
    console.error("loadAiUsage", error instanceof Error ? error.name : "unknown");
    return withRuntime(memory, [...limits.values()]);
  }
}

function withRuntime(usage: AiUsageDay, limits: AiModelLimit[]) {
  const runtime = getAiRuntime();
  const merged = new Map(limits.map((limit) => [limit.model, limit]));
  for (const [model, until] of Object.entries(runtime.cooldowns)) {
    const existing = merged.get(model);
    if (!existing) {
      merged.set(model, {
        model,
        at: until - 60_000,
        until,
        status: 429,
        daily: false,
      });
      continue;
    }
    if (existing.until < until) {
      merged.set(model, { ...existing, until });
    }
  }
  return {
    usage,
    limits: [...merged.values()].sort((a, b) => b.at - a.at),
    runtime,
    resetAt: nextGeminiReset().getTime(),
  };
}
