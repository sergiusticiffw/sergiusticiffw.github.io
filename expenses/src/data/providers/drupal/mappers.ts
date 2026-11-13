import type { ProfilePatch, UserProfile, WriteResult } from '../../types';
import {
  CUSTOM_TAGS_FIELD,
  TAG_MODE_FIELD,
  catalogFromUser,
  serializeCustomTags,
} from '../../../tags/catalog';
import { AI_KEY_FIELD } from '../../../ai/config';

const first = (value: unknown): unknown => {
  const entry = Array.isArray(value) ? value[0] : value;
  if (entry && typeof entry === 'object') {
    return (entry as { value?: unknown; target_id?: unknown }).value ??
      (entry as { target_id?: unknown }).target_id;
  }
  return entry;
};

/** Extract server id from Drupal node create/update JSON. */
export const writeResultFromDrupalNode = (data: any): WriteResult | null => {
  if (!data) return null;
  if (data.nid !== undefined) {
    const id =
      data.nid?.[0]?.value?.toString?.() ||
      data.nid?.toString?.() ||
      String(data.nid);
    return { id, raw: data };
  }
  if (data.id !== undefined) {
    return { id: String(data.id), raw: data };
  }
  return null;
};

export const profileFromDrupalUser = (user: any): UserProfile => {
  const uid = String(user?.uid?.[0]?.value ?? user?.uid ?? '');
  const catalog = catalogFromUser(user || {});
  return {
    uid,
    currency: String(first(user?.field_currency) ?? ''),
    encryption_status: String(
      first(user?.field_encryption_status) ?? ''
    ),
    gemini_api_key:
      (first(user?.[AI_KEY_FIELD]) as string | undefined)?.trim() || '',
    tag_mode: catalog.mode,
    custom_tags: catalog.custom,
    raw: user,
  };
};

export const drupalBodyFromProfilePatch = (
  patch: ProfilePatch
): Record<string, unknown> => {
  const body: Record<string, unknown> = {};
  if (patch.currency !== undefined) {
    body.field_currency = [patch.currency];
  }
  if (patch.encryption_status !== undefined) {
    body.field_encryption_status = [{ value: patch.encryption_status }];
  }
  if (patch.gemini_api_key !== undefined) {
    body[AI_KEY_FIELD] = patch.gemini_api_key
      ? [{ value: patch.gemini_api_key }]
      : [];
  }
  if (patch.tag_mode !== undefined) {
    body[TAG_MODE_FIELD] = [{ value: patch.tag_mode }];
  }
  if (patch.custom_tags !== undefined) {
    body[CUSTOM_TAGS_FIELD] = serializeCustomTags(patch.custom_tags);
  }
  return body;
};
