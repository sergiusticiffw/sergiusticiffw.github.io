import { useSyncExternalStore } from 'react';
import { getSession } from '../crypto/encryptionState';
import { getDataProvider } from '../data';
import {
  TagCatalog,
  catalogFromUser,
  emptyCatalog,
  readTagCache,
  registerTagLogout,
  writeTagCache,
} from './catalog';

export type TagCatalogStatus = 'idle' | 'loading' | 'ready';

interface TagSnapshot {
  uid: string;
  catalog: TagCatalog;
  status: TagCatalogStatus;
}

const listeners = new Set<() => void>();

const loadInitial = (): TagSnapshot => {
  const session = getSession();
  if (!session) return { uid: '', catalog: emptyCatalog(), status: 'idle' };
  return {
    uid: session.uid,
    catalog: readTagCache(session.uid) ?? emptyCatalog(),
    status: 'loading',
  };
};

let snapshot: TagSnapshot = loadInitial();
let requestId = 0;

const publish = (next: TagSnapshot) => {
  snapshot = next;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = () => snapshot;

export const resetTagCatalog = () => {
  requestId += 1;
  publish({ uid: '', catalog: emptyCatalog(), status: 'idle' });
};

registerTagLogout(resetTagCatalog);

const catalogFromProfile = (profile: {
  tag_mode?: TagCatalog['mode'];
  custom_tags?: TagCatalog['custom'];
  raw?: Record<string, unknown>;
}): TagCatalog => {
  if (profile.tag_mode || profile.custom_tags) {
    return {
      mode: profile.tag_mode === 'custom' ? 'custom' : 'default',
      custom: profile.custom_tags || {},
    };
  }
  if (profile.raw) return catalogFromUser(profile.raw);
  return emptyCatalog();
};

export const refreshTagCatalog = async () => {
  const session = getSession();
  if (!session) {
    resetTagCatalog();
    return;
  }

  const id = ++requestId;
  if (snapshot.uid !== session.uid || snapshot.status !== 'ready') {
    publish({
      uid: session.uid,
      catalog:
        snapshot.uid === session.uid
          ? snapshot.catalog
          : (readTagCache(session.uid) ?? emptyCatalog()),
      status: 'loading',
    });
  }

  try {
    const provider = getDataProvider();
    provider.configure(session.token);
    const result = await provider.getProfile(session.uid);
    if (!result.success || !result.data) throw new Error('profile failed');
    const catalog = catalogFromProfile(result.data);
    if (id !== requestId) return;
    writeTagCache(session.uid, catalog);
    publish({ uid: session.uid, catalog, status: 'ready' });
  } catch {
    if (id !== requestId) return;
    publish({ ...snapshot, uid: session.uid, status: 'ready' });
  }
};

export const saveTagCatalog = async (
  catalog: TagCatalog
): Promise<TagCatalog> => {
  const session = getSession();
  if (!session) throw new Error('Not signed in');

  const provider = getDataProvider();
  provider.configure(session.token);
  const result = await provider.updateProfile(session.uid, {
    tag_mode: catalog.mode,
    custom_tags: catalog.custom,
  });
  if (!result.success || !result.data) {
    throw new Error(result.error?.message || 'Failed to save tags');
  }

  const saved = catalogFromProfile(result.data);
  writeTagCache(session.uid, saved);
  publish({ uid: session.uid, catalog: saved, status: 'ready' });
  return saved;
};

/** Apply tags from a backup import into local cache/UI (DB write already done). */
export const applyImportedTagCatalog = (
  uid: string,
  catalog: TagCatalog
): void => {
  writeTagCache(uid, catalog);
  publish({ uid: String(uid), catalog, status: 'ready' });
};

export function getTagCatalog(): TagCatalog {
  return snapshot.catalog;
}

export function useTagCatalog(): TagCatalog {
  return useSyncExternalStore(subscribe, getSnapshot).catalog;
}

export function useTagCatalogState(): TagSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot);
}
