import { AI_LANGUAGES } from './config';
import { getAiLanguage } from './storage';

export type AiLanguage = (typeof AI_LANGUAGES)[number];

export type AiLocalizedString = Record<AiLanguage, string>;

/** Build a localized string for Romanian / English / Russian. */
export const L = (
  Romanian: string,
  English: string,
  Russian: string
): AiLocalizedString => ({ Romanian, English, Russian });

export const resolveAiLanguage = (value?: string): AiLanguage => {
  const language = value || getAiLanguage();
  return (AI_LANGUAGES as readonly string[]).includes(language)
    ? (language as AiLanguage)
    : AI_LANGUAGES[0];
};

export const aiText = (
  texts: AiLocalizedString,
  language?: string
): string => {
  const key = resolveAiLanguage(language);
  return texts[key] || texts.English;
};
