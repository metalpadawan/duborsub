# Deploying AniRate

This guide puts AniRate on the internet on one Linux server (a VPS from Hetzner, DigitalOcean, Linode or similar; 2 GB of RAM is enough to start). Everything runs in Docker: PostgreSQL, the API, the website, and Caddy, which serves both over HTTPS with certificates it obtains and renews itself.

## What you need first

1. **A server** with Docker installed (`curl -fsSL https://get.docker.com | sh` on Ubuntu or Debian).
2. **A domain**, with two DNS `A` records pointing at the server's IP address, for example `anirate.example` for the website and `api.anirate.example` for the API.
3. **An email delivery account** for sign-up confirmation and password-reset emails. Any provider with SMTP works; [Resend](https://resend.com), Postmark and Brevo have free tiers. Verify your domain with them and note the SMTP host, port, username and password (usually an API key).

## First deployment

On the server:

```bash
git clone https://github.com/<you>/duborsub.git
cd duborsub
cp .env.production.example .env.production
```

Fill in every value in `.env.production`. Generate each secret separately:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then start everything:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

The API applies database migrations on every start, and creates the admin account from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` the first time (no demo accounts are ever created in production). Once Caddy has its certificates, usually within a minute, the site is live at `https://SITE_DOMAIN`. Sign in with the admin account and open `/admin`.

The website is built while the database is still empty, so the very first visit to the homepage may show the demo titles for a few seconds while the page regenerates with real data.

## Loading the catalogue

The database starts with only the genres. Load every anime with the same scripts as in development, run inside the API container:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec backend npm run refresh:anime
docker compose -f docker-compose.prod.yml --env-file .env.production exec backend npm run refresh:anime:synopses
```

The first takes about ten minutes (download, Kitsu popularity, import); the second about fifteen (AniList synopses, at AniList's rate limit). Both are safe to rerun, and the site stays up while they run. See [anime-data-import.md](anime-data-import.md) for what each does.

To move an existing local database instead (accounts, ratings and all), back it up locally with `npm run db:backup`, copy the file to the server, and restore it as shown under Backups.

## Updating

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Migrations run automatically when the new API container starts.

## Backups

```bash
node database/backup.mjs --prod --keep 14
```

This writes a compressed `pg_dump` to `backups/` and keeps the newest 14. Schedule it daily with cron (`crontab -e`):

```cron
0 3 * * * cd /path/to/duborsub && node database/backup.mjs --prod --keep 14
```

Copy the `backups/` folder off the server regularly (for example with `rclone` to cloud storage); a backup on the same disk does not survive the disk.

To restore a backup:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T postgres \
  pg_restore -U anirate -d anime_platform --clean --if-exists < backups/<file>.dump
```

## Keeping the catalogue fresh

New anime appear in the sources over time. Schedule a weekly refresh alongside the backups:

```cron
0 4 * * 1 cd /path/to/duborsub && docker compose -f docker-compose.prod.yml --env-file .env.production exec -T backend npm run refresh:anime
```

## Other hosts

The two Dockerfiles also run on platforms such as Render, Railway or Fly.io. Create a managed PostgreSQL database, then two services from `apps/anirate-base/backend` and `apps/anirate-base/frontend` with the same settings as `docker-compose.prod.yml`: the API needs `DATABASE_URL`, `FRONTEND_URL`, `JWT_SECRET`, `INTERNAL_API_KEY`, `TRUST_PROXY=true` and the SMTP settings; the website needs the `NEXT_PUBLIC_*` values as build arguments, plus `API_URL` and the same `INTERNAL_API_KEY` at runtime.

## Checklist before announcing the site

- Sign up with a real address and confirm the email arrives, then try "Forgot password".
- Set `CONTACT_EMAIL`, and have the privacy and terms pages reviewed; they describe what the code does but are not legal advice.
- Confirm a backup runs and restores.
- Rate a few titles from a second account and check the rankings.
