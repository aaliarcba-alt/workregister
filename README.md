# Work Register — Sintex Digital Team

## Setup in 4 steps

### Step 1 — Supabase (5 mins)
1. Go to https://supabase.com → New project (free tier)
2. Go to SQL Editor → paste contents of `supabase_setup.sql` → Run
3. Update passwords in the seed data before running
4. Go to Settings → API → copy `Project URL` and `anon public` key

### Step 2 — Environment variables
1. Copy `.env.local.example` to `.env.local`
2. Fill in your Supabase URL and anon key

### Step 3 — Deploy to Vercel
1. Push this folder to a GitHub repo
2. Go to https://vercel.com → Import project → select your repo
3. Add environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

### Step 4 — Power Automate (keep existing reminders working)
Update your existing Power Automate flow to query Supabase instead of Excel:
- Use HTTP connector
- GET `https://your-supabase-url/rest/v1/work_entries?date=eq.TODAY&select=employee_email`
- Add header: `apikey: your-anon-key`
- If employee email not in results → send reminder email

## Local development
```bash
npm install
npm run dev
```
Open http://localhost:3000

## Screens
- `/login` — Email + password login
- `/dashboard` — Employee work log (add/edit/delete entries)  
- `/manager` — Manager dashboard (team overview, charts, goals breakdown)
