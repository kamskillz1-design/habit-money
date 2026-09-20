# HabitMoney Coach — deploy

Vite + React SPA. Host: Vercel. Data/auth: Supabase.

## Env (Vercel + local `.env.local`)

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Vite inlines env at **build** time. Redeploy after changing env.

Never put the service role key in Vite.

## Supabase

1. Run `supabase/schema.sql` **once** in the SQL Editor.
2. If you must re-run: reset the project or apply only the missing `IF NOT EXISTS` / `drop policy if exists` bits. Do not blindly replay `CREATE TABLE` on a dirty DB.
3. Auth URL config: production Vercel origin + `http://localhost:5173`
   - Redirect URLs should include `/`, `/login`, `/register`, `/reset-password`
4. Providers: **Email** and **Google** (same as the Base44 app).
5. OAuth callback: `https://<project>.supabase.co/auth/v1/callback`
6. Create public Storage bucket named **`imports`**.
7. Storage policies: public read; authenticated upload (and delete-own).
   Commented SQL is at the bottom of `schema.sql`.
8. Realtime: **not used**. Do not need to enable replication.
9. Confirm `profiles` + `user_profiles` rows after first signup (`handle_new_user` trigger).
10. Old Base44 rows are **not** imported by the schema.

## Vercel

1. Import the GitHub repo.
2. Framework preset: Vite. Build: `npm run build`. Output: `dist`.
3. Set the two `VITE_` env vars. Redeploy.
4. Add the production domain to the Supabase Auth allow-list.
5. `vercel.json` rewrites all paths to `index.html` (client router).

## Storage / functions notes

- CSV files go to bucket `imports` as `{userId}/{timestamp}-{filename}`.
- `importCsv`, `loadDemoData`, `manageHousehold`, `recordGoalContribution` run in the browser against RLS.
- `runDailyCoaching` / Daily Coaching workflow is **not** scheduled. Optional later: cron Edge Function.

## CODE

- [ ] No `@base44` packages
- [ ] No `base44Client` / `base44.entities` / `base44.auth` / `media.base44` as a live host
- [ ] One `supabaseClient`
- [ ] Façade `repo()` exists for every table the UI calls
- [ ] AuthContext shape unchanged
- [ ] Uploads use bucket `imports`
- [ ] `schema.sql` matches the façade
- [ ] `vercel.json` SPA rewrites
- [ ] `.env.example` only; no secrets in git
- [ ] Lockfile does not pin Base44
- [ ] `OAuthConsent` is unused (MCP); not in the router
- [ ] Single i18n system (`I18nProvider`); no GTranslate

## GITHUB

- [ ] Source only, no `node_modules`
- [ ] `main` has `package.json`, `index.html`, `src/`, `supabase/schema.sql`, `vercel.json`

## SMOKE TEST

- [ ] Register / login / logout / refresh stays logged in
- [ ] Password reset returns to the Vercel URL
- [ ] Google OAuth if enabled
- [ ] Today / spending / budget load
- [ ] Create / edit a transaction and a goal
- [ ] CSV upload + import
- [ ] User A cannot edit user B’s rows
- [ ] Deep links do not 404
- [ ] Language switcher (`es` / `en` / `eu`) stays in sync
