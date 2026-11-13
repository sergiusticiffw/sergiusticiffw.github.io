import type { AuthProvider } from './authProvider';
import type { DataProvider } from './dataProvider';
import type { DataProviderKind } from './types';
import {
  resolveDataProviderKind,
  setPreferredDataProviderKind,
} from './providerPreference';
import { createDrupalAuthProvider } from './providers/drupal/auth';
import { createDrupalDataProvider } from './providers/drupal/data';
import { createSupabaseAuthProvider } from './providers/supabase/auth';
import { createSupabaseDataProvider } from './providers/supabase/data';

export interface AppProviders {
  kind: DataProviderKind;
  auth: AuthProvider;
  data: DataProvider;
}

let cached: AppProviders | null = null;

export function getDataProviderKind(): DataProviderKind {
  return cached?.kind ?? resolveDataProviderKind();
}

export function createProviders(
  kind: DataProviderKind = resolveDataProviderKind()
): AppProviders {
  if (kind === 'supabase') {
    return {
      kind,
      auth: createSupabaseAuthProvider(),
      data: createSupabaseDataProvider(),
    };
  }
  return {
    kind,
    auth: createDrupalAuthProvider(),
    data: createDrupalDataProvider(),
  };
}

export function getProviders(): AppProviders {
  if (!cached) {
    cached = createProviders(resolveDataProviderKind());
  }
  return cached;
}

export function getAuthProvider(): AuthProvider {
  return getProviders().auth;
}

export function getDataProvider(): DataProvider {
  return getProviders().data;
}

/**
 * Switch backend for this browser (before login / after logout).
 * Clears the provider cache so the next call uses the new kind.
 */
export function setDataProviderKind(kind: DataProviderKind): void {
  setPreferredDataProviderKind(kind);
  cached = null;
}

/** Drop cached providers (e.g. after logout). Kind preference is kept. */
export function resetProviders(): void {
  cached = null;
}
