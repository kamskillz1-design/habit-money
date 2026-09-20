# HabitMoney Coach

Vite + React SPA. Auth and data: Supabase. Host: Vercel.

## Local

```bash
cp .env.example .env.local
# fill VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Dev server: http://localhost:5173

## Deploy (Vercel)

1. Import this repo. Framework: Vite. Build: `npm run build`. Output: `dist`.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Redeploy after adding env (Vite inlines at build time).
3. Add the production URL to Supabase Auth redirect allow-list, plus `http://localhost:5173`.

`vercel.json` rewrites all routes to `index.html`.

## Supabase (once)

1. Run `supabase/schema.sql` in the SQL Editor.
2. Create a **public** Storage bucket named `imports`.
3. Enable Email and Google providers.
4. OAuth callback: `https://<project>.supabase.co/auth/v1/callback`.

Full checklist: [DEPLOY.md](./DEPLOY.md).
