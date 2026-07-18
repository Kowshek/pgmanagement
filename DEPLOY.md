# Deploying pgmanagement as a web app (free-tier-first)

Stack: **Cloudflare Pages** (frontend) + **Railway** (backend API + Postgres + Redis,
all three in one project). Switched from Render+Neon+Upstash on 2026-07-17 — Render's
free tier force-sleeps the backend after 15 min idle (30-60s cold start on the next
hit, bad for a live demo), and juggling three separate dashboards (Render/Neon/Upstash)
for one small app was more moving parts than necessary. Railway consolidates the
backend, database, and Redis into one project/one bill, and doesn't force-sleep.

Cost reality, stated plainly: Railway is not free long-term. New accounts get a
one-time $5 trial credit that expires in 30 days — after that you're on the Hobby
plan, $5/month flat (includes $5 of usage credit; you pay the $5 subscription fee
even if you use less). For a demo/free-trial rig with a handful of PG owners kicking
the tires, actual usage should stay well within that. Revisit hosting before this has
real paying users at scale — this is a trial rig, not a production posture.

Do these in order. Each step feeds the next.

## 0. Before you touch any dashboard

Push the current state of the repo — this now includes `backend/railway.json`
(Railway's config-as-code, replaces the old `render.yaml`, which has been removed)
and a `backend/docker/Dockerfile` fix that copies `alembic.ini` + `alembic/` into the
image (previously missing, which would have made migrations impossible to run
inside the deployed container).

```
git add -A
git commit -m "switch web deploy to Railway: railway.json, Dockerfile alembic fix"
git push origin main
```

## 1. Railway project — railway.com

1. Sign up (GitHub OAuth is fastest).
2. New Project → Empty Project (don't pick a template).
3. **Add Postgres**: inside the project, "+ New" → Database → Add PostgreSQL.
   Railway provisions it and exposes `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`,
   `PGDATABASE`, and a combined `DATABASE_URL` as variables on that service —
   you don't need to copy any of these by hand, the API service references them
   directly (step 3 below).
4. **Add Redis**: "+ New" → Database → Add Redis. Same idea — exposes `REDIS_URL`
   and friends as variables on that service.
5. **Add the API service**: "+ New" → GitHub Repo → pick `pgmanagement`.
   - Set **Root Directory** to `backend` (Settings tab on the new service).
   - Railway will find `backend/railway.json` automatically once the root
     directory is set — it tells Railway to build from `docker/Dockerfile`,
     health-check `/health`, and run `alembic upgrade head` as a pre-deploy
     step before every deploy (so migrations run automatically, no manual
     step against a live database needed — this is cleaner than the old
     Neon/Render setup, where migrations had to be run from your own machine).

## 2. Environment variables on the API service

On the API service → Variables tab, add:

```
JWT_SECRET=<generate one — see below, don't reuse the local dev one>
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
JWT_REFRESH_TOKEN_EXPIRE_DAYS=30
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
CORS_EXTRA_ORIGINS=
```

Notes on these:
- The `${{Postgres.DATABASE_URL}}`-style syntax is Railway's variable reference format —
  it pulls the live connection string from the Postgres service you added in step 1.
- `REDIS_URL` works similarly — `${{Redis.REDIS_URL}}` pulls from the Redis service.
- Generate `JWT_SECRET` locally, don't reuse your dev `.env` value:
  `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`
- Leave `CORS_EXTRA_ORIGINS` blank for now — comes back in step 4 once you know
  your Cloudflare Pages URL.

## 3. Get a public URL + deploy

1. On the API service → Settings → Networking → **Generate Domain**. Railway
   services aren't publicly reachable by default; this step is what actually
   gives you a `https://<something>.up.railway.app` URL. Easy to miss — if you
   skip it, everything else "works" internally but nothing outside Railway can
   reach your API.
2. Trigger a deploy (should happen automatically on the env var save / domain
   generation, or hit "Deploy" manually). First build takes a few minutes.
3. Once live, hit `https://<your-domain>.up.railway.app/health` — should return
   `{"status":"ok"}`. If it doesn't, check the deployment logs — the two most
   likely failures at this stage are a malformed `DATABASE_URL` reference (typo
   in the `${{ }}` syntax) or the pre-deploy migration step failing (check that
   `alembic.ini`/`alembic/` actually made it into the image — see step 0).

## 4. Cloudflare Pages (frontend) — pages.cloudflare.com

1. Sign up, connect GitHub, pick the `pgmanagement` repo.
2. Build settings:
   - Root directory: `pg_manager_mobile`
   - Build command: `npm run build:web`
   - Output directory: `dist`
3. Environment variable: `EXPO_PUBLIC_API_URL` = your Railway domain from step 3
   (e.g. `https://pgmanagement-api-production.up.railway.app`). This gets baked
   into the JS bundle at build time — Expo only picks up `EXPO_PUBLIC_*` vars
   during the build, not at runtime, so if you ever change the backend URL you
   must trigger a rebuild, not just redeploy.
4. Deploy. Cloudflare gives you a `*.pages.dev` URL.
5. `public/_redirects` (already added, contains `/*  /index.html  200`) ships into
   `dist/` automatically and makes deep links / page refreshes work instead of
   404ing — Cloudflare Pages is a static host, it doesn't know about your app's
   routes without it.

## 5. Close the loop: CORS

The backend only accepts cross-origin requests from origins you explicitly allow
(plus localhost, for local dev — see `backend/app/main.py`). Go back to Railway →
API service → Variables, and set:

```
CORS_EXTRA_ORIGINS=https://<your-project>.pages.dev
```

Save — Railway redeploys automatically on variable changes. Until you do this, the
deployed frontend can reach the API from a phone/emulator (native isn't subject to
CORS) but a browser tab hitting your `.pages.dev` URL will get CORS errors on every
API call. Easy to forget because everything else "works" without it — don't skip it.

## 6. Smoke test

- Open the Cloudflare Pages URL in a real browser.
- Register a user, log in, create a property, add a room/guest/payment.
- Refresh the page mid-flow (tests the `_redirects` fallback).
- Railway's Hobby plan doesn't force-sleep on idle the way Render's free tier did,
  so you shouldn't see a cold-start delay here the way the old stack had — but it's
  still worth checking response times feel normal on first load after the app's
  been untouched a while, since Railway (like any platform) can still have some
  variance under its own infra maintenance.

## Known limitations of this stack (read before promising anything to customers)

- Railway's free trial is a one-time $5 credit that expires in 30 days — not an
  ongoing free tier. After that, Hobby plan is $5/month minimum flat fee, billed
  on top of actual usage (CPU/memory/egress) within that credit.
- No forced idle-sleep like Render's free tier, but cost is usage-metered, not a
  fixed instance size — a real spike in traffic (multiple simultaneous demos,
  heavier usage) could push past the $5 Hobby credit and bill more.
- Postgres/Redis plugins here are Railway-managed but still effectively a single
  small instance each — no read replicas, no point-in-time recovery guarantees
  beyond whatever Railway's plugin includes by default. Fine for trial data, not a
  substitute for a real backup strategy once real customers' data is on the line.
- None of this is a production posture for paying customers at real scale — it's a
  demo/trial rig. Treat any of these limits getting hit as the signal to move to a
  paid, properly-provisioned tier, not as a bug to work around.
