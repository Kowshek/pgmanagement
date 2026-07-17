# Deploying pgmanagement as a web app (free tier)

Stack: **Cloudflare Pages** (frontend) + **Render** (backend API) + **Neon** (Postgres) + **Upstash** (Redis).
All four have a genuinely free tier, no credit card. Cost of "free": Render's backend
sleeps after 15 min idle (30-60s cold start on the next request), and Neon caps out at
0.5GB storage / scale-to-zero. Fine for a demo or free-trial customers kicking the
tires. Not fine as a permanent home once this has real paying users — revisit hosting
before that happens, not after.

Do these in order. Each step feeds the next.

## 0. Before you touch any dashboard

Push the current state of the repo (including `render.yaml`, `public/_redirects`, and
the debug-endpoint removal) to GitHub — everything below deploys from the `main`
branch on `Kowshek/pgmanagement`.

```
git add -A
git commit -m "prep for web deploy: drop debug endpoint, add render.yaml, redirects"
git push origin main
```

## 1. Neon (Postgres) — neon.tech

1. Sign up (GitHub OAuth is fastest).
2. Create a project. Any region close to you is fine.
3. On the project dashboard, copy the connection string. Neon shows it in the
   `psycopg`/`sslmode=require` format — **you must edit it**:
   - Change the scheme from `postgresql://` to `postgresql+asyncpg://`
   - Change `?sslmode=require` to `?ssl=require`
   - End result looks like:
     `postgresql+asyncpg://<user>:<password>@<host>/<dbname>?ssl=require`
   - This isn't optional — `asyncpg` doesn't understand `sslmode` and the app will
     fail to connect if you paste Neon's string verbatim. (This bit SQLAlchemy users
     constantly enough that I bumped `sqlalchemy` to `>=2.0.33` in `pyproject.toml`
     to get the fix, but the URL still needs the param renamed.)
4. Save that final string somewhere — it's your `DATABASE_URL` for step 3.

## 2. Upstash (Redis) — upstash.com

1. Sign up (GitHub OAuth).
2. Create a Redis database, any region.
3. Copy the connection string labeled for general/`redis-cli` use — it'll start with
   `rediss://` (note the double-s, meaning TLS). Use it as-is.
4. Save it — it's your `REDIS_URL` for step 3.

## 3. Render (backend API) — render.com

1. Sign up (GitHub OAuth), then connect your GitHub account so Render can see the
   `pgmanagement` repo.
2. New → Blueprint → pick the `pgmanagement` repo. Render will read `render.yaml`
   from the repo root and propose one service: `pgmanagement-api`.
3. When it asks for the env vars marked `sync: false`, fill in:
   - `DATABASE_URL` → the edited Neon string from step 1
   - `REDIS_URL` → the Upstash string from step 2
   - `JWT_SECRET` → generate a real one, don't reuse the placeholder in `.env.example`.
     Run this locally and paste the output: `openssl rand -hex 32`
   - `CORS_EXTRA_ORIGINS` → leave blank for now, you'll come back and set this in
     step 5 once you know your Cloudflare Pages URL.
4. Deploy. First build takes a few minutes (it's building the Docker image from
   `backend/docker/Dockerfile`). Once live, hit `https://<your-service>.onrender.com/health`
   — should return `{"status":"ok"}`.
5. Run the DB migrations once, against the live Neon database. Easiest way without
   installing anything extra: from your machine, in `backend/`, temporarily point
   `.env`'s `DATABASE_URL` at the Neon string and run `alembic upgrade head`, then put
   `.env` back to the local docker-compose value. (Don't leave your local `.env`
   pointed at prod — that's exactly the kind of thing that causes a bad day.)

## 4. Cloudflare Pages (frontend) — pages.cloudflare.com

1. Sign up, connect GitHub, pick the `pgmanagement` repo.
2. Build settings:
   - Root directory: `pg_manager_mobile`
   - Build command: `npm run build:web`
   - Output directory: `dist`
3. Environment variable: `EXPO_PUBLIC_API_URL` = your Render URL from step 3
   (e.g. `https://pgmanagement-api.onrender.com`). This gets baked into the JS bundle
   at build time — Expo only picks up `EXPO_PUBLIC_*` vars during the build, not at
   runtime, so if you ever change the backend URL you must rebuild, not just redeploy.
4. Deploy. Cloudflare gives you a `*.pages.dev` URL.
5. `public/_redirects` (already added, contains `/*  /index.html  200`) ships into
   `dist/` automatically and makes deep links / page refreshes work instead of 404ing
   — Cloudflare Pages is a static host, it doesn't know about your app's routes
   without it.

## 5. Close the loop: CORS

The backend only accepts cross-origin requests from origins you explicitly allow
(plus localhost, for local dev — see `backend/app/main.py`). Go back to Render →
your service → Environment, and set:

```
CORS_EXTRA_ORIGINS=https://<your-project>.pages.dev
```

Save, let it redeploy. Until you do this, the deployed frontend can reach the API
from a phone/emulator (native isn't subject to CORS) but a browser tab hitting your
`.pages.dev` URL will get CORS errors on every API call. This step is easy to forget
because everything else "works" without it — don't skip it.

## 6. Smoke test

- Open the Cloudflare Pages URL in a real browser.
- Register a user, log in, create a property, add a room/guest/payment.
- Refresh the page mid-flow (tests the `_redirects` fallback).
- Expect the *first* request after any idle period to take 30-60s (Render cold
  start). That's not a bug, that's the free tier. If a customer trial depends on
  snappy first-impressions, this is the thing that will bite you — the fix is a paid
  Render plan, not a code change.

## Known limitations of this stack (read before promising anything to customers)

- Render free web service sleeps after 15 min idle → cold start on next hit.
- Neon free tier: 0.5GB storage, 100 compute-hours/month, scales to zero when idle.
- Upstash free tier: 256MB, 500K commands/month.
- None of this is a production posture for paying customers at any real scale — it's
  a demo/trial rig. Treat any of these limits getting hit as the signal to move to a
  paid tier, not as a bug to work around.
