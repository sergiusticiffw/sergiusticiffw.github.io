#!/usr/bin/env node
/**
 * Wipe all app data for one Supabase user (keeps the auth account).
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/wipe-user-data.mjs <user-uuid> --dry-run
 *   SUPABASE_SERVICE_ROLE_KEY=... node scripts/wipe-user-data.mjs <user-uuid> --confirm
 *
 * Env:
 *   VITE_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (Dashboard → Settings → API → service_role)
 *
 * Flags:
 *   --dry-run   count only
 *   --confirm   actually delete
 *   --reset-profile  clear tags + gemini on profiles
 *   --leave-family   leave household_members + invites created by user
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'));
loadEnvFile(resolve(process.cwd(), '.env'));

const args = process.argv.slice(2);
const uid = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
const confirm = args.includes('--confirm');
const resetProfile = args.includes('--reset-profile');
const leaveFamily = args.includes('--leave-family');

if (!uid || !/^[0-9a-f-]{36}$/i.test(uid)) {
  console.error(
    'Usage: node scripts/wipe-user-data.mjs <user-uuid> [--dry-run|--confirm] [--reset-profile] [--leave-family]'
  );
  process.exit(1);
}

if (!dryRun && !confirm) {
  console.error('Refusing to run without --dry-run or --confirm');
  process.exit(1);
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    'Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
  );
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function countEq(table, column, value) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(column, value);
  if (error) throw error;
  return count ?? 0;
}

async function deleteEq(table, column, value) {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .eq(column, value);
  if (error) throw error;
  return count ?? 0;
}

async function main() {
  console.log(`User: ${uid}`);
  console.log(dryRun ? 'Mode: dry-run' : 'Mode: DELETE');

  const payments = await countEq('payments', 'user_id', uid);
  const loans = await countEq('loans', 'user_id', uid);
  const transactions = await countEq('transactions', 'user_id', uid);
  const members = await countEq('household_members', 'user_id', uid);
  const invites = await countEq('household_invites', 'invited_by', uid);

  console.log({
    payments,
    loans,
    transactions,
    household_members: members,
    household_invites_created: invites,
  });

  if (dryRun) {
    console.log('Dry-run only. Re-run with --confirm to delete.');
    return;
  }

  // payments first (FK → loans)
  const delPayments = await deleteEq('payments', 'user_id', uid);
  const delLoans = await deleteEq('loans', 'user_id', uid);
  const delTx = await deleteEq('transactions', 'user_id', uid);
  console.log('Deleted:', {
    payments: delPayments,
    loans: delLoans,
    transactions: delTx,
  });

  if (resetProfile) {
    const { error } = await supabase
      .from('profiles')
      .update({
        tag_mode: 'default',
        custom_tags: {},
        gemini_api_key: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', uid);
    if (error) throw error;
    console.log('Profile tags + gemini cleared.');
  }

  if (leaveFamily) {
    const delInv = await deleteEq('household_invites', 'invited_by', uid);
    const delMem = await deleteEq('household_members', 'user_id', uid);
    // orphan households owned by user with no members
    const { data: owned, error: ownErr } = await supabase
      .from('households')
      .select('id')
      .eq('created_by', uid);
    if (ownErr) throw ownErr;
    for (const h of owned || []) {
      const { count } = await supabase
        .from('household_members')
        .select('*', { count: 'exact', head: true })
        .eq('household_id', h.id);
      if ((count ?? 0) === 0) {
        const { error } = await supabase.from('households').delete().eq('id', h.id);
        if (error) throw error;
        console.log(`Deleted empty household ${h.id}`);
      }
    }
    console.log('Family:', { invites: delInv, memberships: delMem });
  }

  console.log('Done. Re-import backup from Profile when ready.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
