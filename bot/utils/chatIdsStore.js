'use strict';

const fs = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CHAT_IDS_PATH = path.join(DATA_DIR, 'chat_ids.json');

async function ensureStorageFile() {
  try {
    // Ensure the directory + JSON file exist.
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.access(CHAT_IDS_PATH);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(CHAT_IDS_PATH, '[]', 'utf8');
  }
}

function normalizeId(id) {
  const n = Number(id);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

async function readChatIds() {
  await ensureStorageFile();
  const raw = await fs.readFile(CHAT_IDS_PATH, 'utf8');

  // Be tolerant to manual edits/corrupted JSON.
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = [];
  }

  if (!Array.isArray(parsed)) return [];
  return [...new Set(parsed.map(normalizeId).filter((x) => x !== null))];
}

async function writeChatIds(chatIds) {
  await fs.mkdir(DATA_DIR, { recursive: true });

  // Keep the file deterministic: unique + sorted.
  const unique = [...new Set(chatIds)].sort((a, b) => a - b);
  const tmpPath = `${CHAT_IDS_PATH}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(unique, null, 2), 'utf8');
  await fs.rename(tmpPath, CHAT_IDS_PATH);
}

async function getChatIds() {
  return readChatIds();
}

async function addChatId(chatId) {
  const id = normalizeId(chatId);
  if (id === null) return false;

  const existing = await readChatIds();
  if (existing.includes(id)) return false;

  existing.push(id);
  await writeChatIds(existing);
  return true;
}

async function removeChatId(chatId) {
  const id = normalizeId(chatId);
  if (id === null) return false;

  const existing = await readChatIds();
  if (!existing.includes(id)) return false;

  const next = existing.filter((x) => x !== id);
  await writeChatIds(next);
  return true;
}

module.exports = { getChatIds, addChatId, removeChatId };

