# Deployment Guide

Step-by-step guide to deploy AniRate to Railway (backend + DB) and Vercel (frontend).

---

## Architecture

```
Browser → Vercel (Next.js) → Railway API (NestJS) → Railway PostgreSQL
```

Both services are on free tiers initially. Railway's $5/mo hobby plan is recommended for the DB to avoid sleep.

---

## 1 — Railway (API + Database)

### 1.1 Create project

1. Go to [railway.app](https://railway.app) → New Project
2. Choose **Empty project**

### 1.2 Add PostgreSQL

1. Click **+ New** → **Database** → **PostgreSQL**
2. Railway provisions a Postgres instance automatically
3. Click the Postgres service → **Variables** tab
4. Copy the `DATABASE_URL` value — you'll need it shortly

### 1.3 Run the schema

```bash
# Install the Railway CLI
npm install -g @railway/cli
railway login

# Link to your project
railway link

# Run schema against the production DB
railway run psql $DATABASE_URL < schema.sql
```

### 1.4 Deploy the API

1. Click **+ New** → **GitHub Repo** → select your repo
2. Set **Root Directory** to `backend`
3. Railway auto-detects Node.js and runs `npm run build`
4. Set the following **Environment Variables** in Railway:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | *(auto-linked from Postgres service)* |
| `JWT_SECRET` | `openssl rand -hex 64` |
| `FRONTEND_URL` | `https://your-app.vercel.app` *(fill after Vercel deploy)* |
| `SMTP_HOST` | Your SMTP host (see below) |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Your SMTP username |
| `SMTP_PASS` | Your SMTP password |
| `SMTP_FROM` | `AniRate <noreply@yourdomain.com>` |

5. Copy your Railway API URL (e.g. `https://anime-api-production.up.railway.app`)

### 1.5 Copy railway.toml

Copy `deploy/backend.railway.toml` to `backend/railway.toml` in your repo. This tells Railway how to build and start the app.

---

## 2 — Vercel (Frontend)

### 2.1 Import project

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Set **Root Directory** to `frontend`
4. Framework preset: **Next.js** (auto-detected)

### 2.2 Environment variables

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://anime-api-production.up.railway.app/api/v1` |

### 2.3 Deploy

Click **Deploy**. Vercel builds and deploys in ~2 minutes.

### 2.4 Update Railway FRONTEND_URL

Go back to Railway → API service → Variables:
- Set `FRONTEND_URL` to your Vercel URL (e.g. `https://anirate.vercel.app`)

---

## 3 — SMTP (Email)

Choose one of these free-tier SMTP providers:

### Resend (recommended — 3,000 emails/month free)
1. Sign up at [resend.com](https://resend.com)
2. Add your domain (or use their sandbox)
3. Create an API key
4. Settings:
   - `SMTP_HOST`: `smtp.resend.com`
   - `SMTP_PORT`: `465`
   - `SMTP_USER`: `resend`
   - `SMTP_PASS`: your Resend API key

### Brevo (formerly Sendinblue — 300 emails/day free)
1. Sign up at [brevo.com](https://brevo.com)
2. Go to SMTP & API → Generate SMTP key
3. Settings:
   - `SMTP_HOST`: `smtp-relay.brevo.com`
   - `SMTP_PORT`: `587`
   - `SMTP_USER`: your Brevo login email
   - `SMTP_PASS`: your SMTP key

### Local development
During development, the app automatically uses [Ethereal](https://ethereal.email) — a fake SMTP inbox. The preview URL is logged to console on every email send. No configuration needed.

---

## 4 — GitHub Actions CI/CD

### 4.1 Add secrets to GitHub

In your repo → Settings → Secrets → Actions:

| Secret | Where to get it |
|--------|----------------|
| `RAILWAY_TOKEN` | Railway → Account Settings → Tokens |
| `VERCEL_TOKEN` | Vercel → Account Settings → Tokens |
| `VERCEL_ORG_ID` | `vercel whoami --json` |
| `VERCEL_PROJECT_ID` | `.vercel/project.json` after `vercel link` |

### 4.2 How it works

- Every push to `main` → runs lint + tests
- Every `git tag v1.x.x` push → deploys to Railway + Vercel

```bash
# To trigger a production deploy:
git tag v1.0.0
git push origin v1.0.0
```

---

## 5 — Post-deploy Checklist

- [ ] Confirm API health: `curl https://your-api.railway.app/api/v1/health`
- [ ] Register a test account and log in
- [ ] Trigger a password reset and confirm the email arrives
- [ ] Create the first admin user directly in the DB:
  ```sql
  UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
  ```
- [ ] Add some anime via the admin panel
- [ ] Set up a cron job to purge expired tokens (Railway cron or pg_cron):
  ```sql
  DELETE FROM password_reset_tokens WHERE expires_at < NOW();
  DELETE FROM refresh_tokens WHERE expires_at < NOW();
  ```
- [ ] Enable Cloudflare proxy in front of both services (free tier) for DDoS protection and CDN

---

## 6 — Environment Variables Reference

### Backend (Railway)

```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://...
JWT_SECRET=<64-char random hex>
FRONTEND_URL=https://your-app.vercel.app
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=<resend api key>
SMTP_FROM=AniRate <noreply@yourdomain.com>
```

### Frontend (Vercel)

```env
NEXT_PUBLIC_API_URL=https://your-api.railway.app/api/v1
```
