import { AI_RESPONSE_STYLES, AI_STORAGE_KEYS, AiResponseStyle } from './config';

export type AiBehaviorPreferences = {
  responseStyle: AiResponseStyle;
};

export const defaultAiPreferences = (): AiBehaviorPreferences => ({
  responseStyle: 'balanced',
});

const isStyle = (value: unknown): value is AiResponseStyle =>
  typeof value === 'string' &&
  (AI_RESPONSE_STYLES as readonly string[]).includes(value);

export const cleanAiPreferences = (raw: unknown): AiBehaviorPreferences => {
  const defaults = defaultAiPreferences();
  if (!raw || typeof raw !== 'object') return defaults;
  const row = raw as Record<string, unknown>;
  return {
    responseStyle: isStyle(row.responseStyle)
      ? row.responseStyle
      : defaults.responseStyle,
  };
};

export const getAiPreferences = (): AiBehaviorPreferences => {
  try {
    return cleanAiPreferences(
      JSON.parse(localStorage.getItem(AI_STORAGE_KEYS.preferences) || 'null')
    );
  } catch {
    return defaultAiPreferences();
  }
};

export const setAiPreferences = (
  prefs: AiBehaviorPreferences
): AiBehaviorPreferences => {
  const next = cleanAiPreferences(prefs);
  localStorage.setItem(AI_STORAGE_KEYS.preferences, JSON.stringify(next));
  void import('../features/profile/preferencesSync')
    .then((m) => m.schedulePreferencesPush({ aiBehavior: next }))
    .catch(() => undefined);
  return next;
};

export const patchAiPreferences = (
  patch: Partial<AiBehaviorPreferences>
): AiBehaviorPreferences =>
  setAiPreferences({ ...getAiPreferences(), ...patch });

/** Extra system-instruction lines from response style. */
export const buildBehaviorInstruction = (
  prefs: AiBehaviorPreferences = getAiPreferences()
): string => {
  if (prefs.responseStyle === 'concise') {
    return 'Response style: concise. Keep answers short and direct.';
  }
  if (prefs.responseStyle === 'detailed') {
    return 'Response style: detailed. Expand on reasoning and cover edge cases when useful.';
  }
  return 'Response style: balanced. Be clear without unnecessary length.';
};
