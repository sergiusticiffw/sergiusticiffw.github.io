import { useCallback, useEffect, useState } from 'react';
import { useAuthState } from '@shared/context';
import {
  ApiKeySync,
  fetchOpenrouterApiKeyFromServer,
  saveOpenrouterApiKeyToServer,
} from '../apiKey';
import {
  getStoredOpenrouterApiKey,
  openrouterKeyLookup,
  setStoredOpenrouterApiKey,
} from '../storage';
import { useAiApiKey, ApiKeyStatus } from './useAiApiKey';

export type AiAccessStatus = ApiKeyStatus;

/**
 * Gemini + OpenRouter keys with the same profile sync pattern as Gemini
 * (localStorage mirror + pull/push via updateProfile on Supabase).
 */
export function useAiAccess() {
  const gemini = useAiApiKey();
  const { token, userDetails } = useAuthState();
  const uid = userDetails?.current_user?.uid;

  const [openrouterApiKey, setOpenrouterApiKey] = useState(
    getStoredOpenrouterApiKey
  );
  const [openrouterStatus, setOpenrouterStatus] = useState<ApiKeyStatus>(
    openrouterApiKey
      ? 'ready'
      : openrouterKeyLookup.serverHasNoKey
        ? 'missing'
        : 'loading'
  );
  const [openrouterSynced, setOpenrouterSynced] = useState(true);

  useEffect(() => {
    if (
      openrouterApiKey ||
      openrouterKeyLookup.serverHasNoKey ||
      !uid ||
      !token
    ) {
      setOpenrouterStatus(openrouterApiKey ? 'ready' : 'missing');
      return;
    }
    let cancelled = false;
    fetchOpenrouterApiKeyFromServer(uid, token)
      .then((key) => {
        openrouterKeyLookup.serverHasNoKey = !key;
        if (cancelled) return;
        setStoredOpenrouterApiKey(key);
        setOpenrouterApiKey(key);
        setOpenrouterStatus(key ? 'ready' : 'missing');
      })
      .catch(() => {
        if (!cancelled) setOpenrouterStatus('missing');
      });
    return () => {
      cancelled = true;
    };
  }, [openrouterApiKey, uid, token]);

  const saveOpenrouter = useCallback(
    async (key: string): Promise<ApiKeySync> => {
      const trimmed = key.trim();
      const result = await saveOpenrouterApiKeyToServer(uid, token, trimmed);
      openrouterKeyLookup.serverHasNoKey = !trimmed;
      setStoredOpenrouterApiKey(trimmed);
      setOpenrouterApiKey(trimmed);
      setOpenrouterStatus(trimmed ? 'ready' : 'missing');
      setOpenrouterSynced(result === 'synced');
      return result;
    },
    [uid, token]
  );

  const hasProvider = Boolean(gemini.apiKey) || Boolean(openrouterApiKey);

  let status: AiAccessStatus;
  if (hasProvider) {
    status = 'ready';
  } else if (gemini.status === 'loading' || openrouterStatus === 'loading') {
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
    openrouterSynced,
    saveOpenrouter,
  };
}
