-- OpenRouter API key on profiles (same pattern as gemini_api_key).
alter table public.profiles
  add column if not exists openrouter_api_key text;
