/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CRYPT_KEY: string;
  readonly VITE_DATA_PROVIDER?: 'drupal' | 'supabase' | string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_FORCE_LOGS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
