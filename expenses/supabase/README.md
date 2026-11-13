# Supabase backend

1. Create a Supabase project.
2. Run [`migrations/20260328120000_init.sql`](migrations/20260328120000_init.sql) in the SQL editor (or via CLI).
3. **Authentication → Providers → Google** — enable it and set:
   - **Client ID** + **Client Secret** from the same Google Cloud OAuth client used by the SPA  
     (`14695610160-ui3d8l2qa7tdjfi4s1t46hfl609qcmie.apps.googleusercontent.com` in `AuthProvider`).
4. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000/expenses` (and your production URL later)
   - Redirect URLs: add  
     `http://localhost:3000/expenses/login`  
     `https://YOUR_DOMAIN/expenses/login`
5. In [Google Cloud Console](https://console.cloud.google.com/) → Credentials → your OAuth client → **Authorized redirect URIs**, add:  
   `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
6. Copy project URL + anon key into `.env.local` (local) **and** GitHub Actions secrets (deploy):

```bash
VITE_DATA_PROVIDER=drupal
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=...
```

**GitHub → Settings → Secrets and variables → Actions** — add:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`  
(plus existing `VITE_CRYPT_KEY`). The `node.js.yml` workflow injects them at build time so one deploy serves Classic (Drupal) + New (Supabase).

Login uses **Supabase Google OAuth redirect** (not a raw Google access token). Login UI defaults to Classic; users pick New to use Supabase.

## Import a backup JSON (`expenses-full-backup`)

1. Log in with Google (Supabase provider).
2. **Profile → Data backup → Import from backup JSON** and pick your `expenses-full-backup` file.

Imports transactions, incomes, loans, payments, profile (tags + Gemini key + currency), and Goals. Loan IDs are remapped so payments stay linked.

Goals (emergency fund) sync to `profiles.preferences` on Supabase — not Google Drive. Drive is only used for optional full JSON backups.

Create a fresh backup from Profile while still on Drupal (`VITE_DATA_PROVIDER=drupal`) so profile + goals fields are included.

## Family households

Run after init:
1. [`migrations/20260328130000_family_households.sql`](migrations/20260328130000_family_households.sql)
2. [`migrations/20260328131000_create_household_rpc.sql`](migrations/20260328131000_create_household_rpc.sql) (RPC + grants — fixes RLS on create)
3. [`migrations/20260328132000_family_aggregates_only.sql`](migrations/20260328132000_family_aggregates_only.sql) (drop partner-row SELECT; aggregate RPC only)
4. [`migrations/20260328133000_household_member_emails.sql`](migrations/20260328133000_household_member_emails.sql) (member list shows email, not UUID)
5. [`migrations/20260328134000_profile_preferences.sql`](migrations/20260328134000_profile_preferences.sql) (`profiles.preferences` jsonb — theme, language, charts, AI prefs, goals cache)
6. [`migrations/20260328135000_family_member_category_totals.sql`](migrations/20260328135000_family_member_category_totals.sql) (per-member shared-category aggregates for chart drill-down)

Family budget shows **combined totals per shared category** — not partner transaction lists. Each member keeps edit/delete on their own rows only.

Then in the app (Supabase provider): **Profile → Family budget** to create a household, invite by email, set shared categories. Invitees join by signing in with that Google email. Budget rings get a **Personal | Family** toggle.
