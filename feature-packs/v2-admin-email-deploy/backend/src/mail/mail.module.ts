// src/mail/mail.module.ts
import { Module, Global } from '@nestjs/common';
import { MailService } from './mail.service';

@Global()
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}

// ─────────────────────────────────────────────────────────────
// PATCH: auth.service.ts — forgotPassword() updated to call MailService
// Replace the TODO comment in the original auth.service.ts with this:
// ─────────────────────────────────────────────────────────────
//
// 1. Inject MailService in the AuthService constructor:
//
//   constructor(
//     private prisma: PrismaService,
//     private jwt: JwtService,
//     private config: ConfigService,
//     private mail: MailService,   // ← ADD THIS
//   ) {}
//
// 2. In forgotPassword(), replace the TODO comment block with:
//
//   await this.mail.sendPasswordReset(user.email, user.username, rawToken);
//
// 3. In register(), add a welcome email after user creation:
//
//   await this.mail.sendWelcome(user.email, user.username).catch(() => null);
//
// 4. In AdminService.banUser(), add ban notification:
//
//   await this.mail.sendBanNotification(user.email, user.username, dto.reason, dto.bannedUntil ? new Date(dto.bannedUntil) : undefined).catch(() => null);
//
// ─────────────────────────────────────────────────────────────
// FRONTEND: Reset password page
// src/app/reset-password/page.tsx
// ─────────────────────────────────────────────────────────────
