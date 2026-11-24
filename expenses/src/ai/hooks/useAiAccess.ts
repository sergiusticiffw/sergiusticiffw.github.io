import { useCallback, useEffect, useState } from 'react';
import { PREFS_APPLIED_EVENT } from '../../features/profile/preferencesSync';
import {
  getStoredOpenrouterApiKey,
  setStoredOpenrouterApiKey,
} from '../storage';
import { useAiApiKey, ApiKeyStatus } from './useAiApiKey';

export type AiAccessStatus = ApiKeyStatus;

/**
 * Unified assistant readiness: Gemini key and/or OpenRouter Free key.
 */
export function useAiAccess() {
  const gemini = useAiApiKey();
  const [openrouterApiKey, setOpenrouterApiKey] = useState(
    getStoredOpenrouterApiKey
  );

  useEffect(() => {
    const refresh = () => setOpenrouterApiKey(getStoredOpenrouterApiKey());
    window.addEventListener(PREFS_APPLIED_EVENT, refresh);
    return () => window.removeEventListener(PREFS_APPLIED_EVENT, refresh);
  }, []);

  const saveOpenrouter = useCallback(async (key: string) => {
    const trimmed = key.trim();
    setStoredOpenrouterApiKey(trimmed);
    setOpenrouterApiKey(trimmed);
    return 'synced' as const;
  }, []);

  const hasProvider = Boolean(gemini.apiKey) || Boolean(openrouterApiKey);

  let status: AiAccessStatus;
  if (hasProvider) {
    status = 'ready';
  } else if (gemini.status === 'loading') {
    status = 'loading';
  } else {
    status = 'missing';
  }

  return {
    status,
    geminiApiKey: gemini.apiKey,
    geminiStatus: gemini.status,
    geminiSynced: gemini.synced,
    saveGemini: gemini.save,
    openrouterApiKey,
    saveOpenrouter,
  };
}
