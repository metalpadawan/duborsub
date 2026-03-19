# AniRate — v2 Additions

This package adds three major features on top of the base project:

> Repository note: this is the first incremental feature pack. Apply it on top of `../../apps/anirate-base`; it is not a standalone application.

---

## 1 — Admin Dashboard UI

Dark monospace-themed interface with 5 sections:

| Route | What it does |
|---|---|
| `/admin` | Stats overview + top-rated anime + recent admin activity |
| `/admin/users` | Search + paginate all users · Ban with reason/expiry · Unban |
| `/admin/anime` | Full CRUD — create/edit/delete anime, assign genres |
| `/admin/comments` | Browse all comments across all anime · One-click removal |
| `/admin/logs` | Immutable audit log with action badges, IP, metadata · Auto-refreshes |

**Access control**: The layout immediately redirects non-admin users to `/`. All API routes additionally enforce `role: admin` via `RolesGuard`.

### How to promote a user to admin

```sql
UPDATE users SET role = 'admin' WHERE email = 'you@example.com';
```

---

## 2 — Email Flow (Nodemailer)

Three transactional emails with responsive HTML templates:

| Trigger | Email sent |
|---|---|
| `POST /auth/register` | Welcome email |
| `POST /auth/forgot-password` | Password reset link (60-min expiry) |
| `POST /admin/users/:id/ban` | Ban notification |

**Development**: Uses [Ethereal](https://ethereal.email) automatically — no config needed. Preview URL logged to console on every send.

**Production**: Set these environment variables:

```env
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=<your-resend-api-key>
SMTP_FROM=AniRate <noreply@yourdomain.com>
```

Recommended provider: [Resend](https://resend.com) — 3,000 emails/month free, dead-simple setup.

### Wire up the mailer

In `backend/src/app.module.ts`, add `MailModule` to imports:

```ts
import { MailModule } from './mail/mail.module';

@Module({
  imports: [
    // ... existing imports
    MailModule,
  ],
})
```

In `auth.service.ts`, inject `MailService` and replace the `// TODO` comments:

```ts
constructor(
  private prisma: PrismaService,
  private jwt: JwtService,
  private config: ConfigService,
  private mail: MailService,   // ← add
) {}

// In register():
await this.mail.sendWelcome(user.email, user.username).catch(() => null);

// In forgotPassword():
await this.mail.sendPasswordReset(user.email, user.username, rawToken);

// In AdminService.banUser():
await this.mail.sendBanNotification(user.email, user.username, dto.reason, ...).catch(() => null);
```

---

## 3 — Deployment

### Files added

```
docker-compose.yml              Full local stack (postgres + api + web)
backend/Dockerfile              Multi-stage NestJS image (non-root user)
frontend/Dockerfile             Multi-stage Next.js standalone image
deploy/backend.railway.toml     Railway build + start config
deploy/vercel.json              Vercel headers + API rewrite
.github/workflows/deploy.yml    CI on every push; deploy on git tag
DEPLOY.md                       Step-by-step Railway + Vercel guide
```

### Quick local run (Docker)

```bash
# Copy and fill in env
cp backend/.env.example .env
# Set at minimum: POSTGRES_PASSWORD and JWT_SECRET

docker compose up --build
# → API:  http://localhost:4000/api/v1/health
# → Web:  http://localhost:3000
```

### Production deploy

See **DEPLOY.md** for the full step-by-step guide covering:
- Railway project setup + PostgreSQL provisioning
- Vercel frontend deploy + environment variables
- SMTP provider setup (Resend recommended)
- GitHub Actions secrets + tag-based deploy workflow
- Post-deploy checklist

---

## New files in this package

```
frontend/src/app/
  admin/layout.tsx              Sidebar + topbar (redirects non-admins)
  admin/page.tsx                Overview dashboard
  admin/users/page.tsx          User management + ban modal
  admin/anime/page.tsx          Anime CRUD panel
  admin/comments/page.tsx       Comment moderation
  admin/logs/page.tsx           Audit log viewer
  reset-password/page.tsx       Token-based password reset form
  register/page.tsx             Registration page (standalone)
  forgot-password/page.tsx      Forgot password form + sent confirmation

backend/src/
  main.ts                       Updated — global filter + interceptor wired
  mail/mail.service.ts          Nodemailer + 3 HTML email templates
  mail/mail.module.ts           Global mail module + integration notes
  health/health.controller.ts   /health endpoint for Railway
  common/filters/               Global HTTP exception filter
  common/interceptors/          Response transform interceptor
  auth/auth.service.spec.ts     Unit tests (register, login, lockout, reset, refresh)
  test/anime.e2e-spec.ts        E2E tests (anime CRUD, ratings, input validation)
  test/jest-e2e.json            E2E Jest config
  admin/admin.comments.patch.ts Patch instructions for GET /admin/comments
```
