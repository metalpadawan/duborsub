// src/mail/mail.service.ts
// Nodemailer-based mailer with HTML email templates
// Install: npm install nodemailer @types/nodemailer

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;

  constructor(private config: ConfigService) {
    const isDev = config.get('NODE_ENV') !== 'production';

    if (isDev) {
      // In development, use Ethereal (fake SMTP — logs preview URL to console)
      nodemailer.createTestAccount().then((account) => {
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          auth: { user: account.user, pass: account.pass },
        });
        this.logger.log(`Dev SMTP ready: ${account.user}`);
      });
    } else {
      this.transporter = nodemailer.createTransport({
        host: config.getOrThrow('SMTP_HOST'),
        port: config.get<number>('SMTP_PORT', 587),
        secure: config.get<number>('SMTP_PORT', 587) === 465,
        auth: {
          user: config.getOrThrow('SMTP_USER'),
          pass: config.getOrThrow('SMTP_PASS'),
        },
      });
    }
  }

  // ── Password reset ─────────────────────────────────────────
  async sendPasswordReset(to: string, username: string, token: string) {
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    const expiryMinutes = 60;

    await this.send({
      to,
      subject: 'Reset your AniRate password',
      html: passwordResetTemplate({ username, resetUrl, expiryMinutes }),
      text: `Hi ${username},\n\nReset your password: ${resetUrl}\n\nExpires in ${expiryMinutes} minutes.\n\nIf you didn't request this, ignore this email.`,
    });
  }

  // ── Welcome email ──────────────────────────────────────────
  async sendWelcome(to: string, username: string) {
    const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');

    await this.send({
      to,
      subject: 'Welcome to AniRate!',
      html: welcomeTemplate({ username, frontendUrl }),
      text: `Welcome to AniRate, ${username}! Start rating anime at ${frontendUrl}`,
    });
  }

  // ── Ban notification ───────────────────────────────────────
  async sendBanNotification(to: string, username: string, reason?: string, until?: Date) {
    await this.send({
      to,
      subject: 'Your AniRate account has been suspended',
      html: banTemplate({ username, reason, until }),
      text: `Hi ${username}, your account has been suspended${reason ? ` for: ${reason}` : ''}.`,
    });
  }

  // ── Core send ──────────────────────────────────────────────
  private async send(opts: { to: string; subject: string; html: string; text: string }) {
    try {
      const from = this.config.get('SMTP_FROM', 'AniRate <noreply@anirate.app>');
      const info = await this.transporter.sendMail({ from, ...opts });

      // In dev, log the Ethereal preview URL
      if (this.config.get('NODE_ENV') !== 'production') {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) this.logger.log(`Email preview: ${previewUrl}`);
      }
    } catch (err) {
      this.logger.error('Failed to send email', err);
      // Don't throw — email failure should not break the request
    }
  }
}

// ── HTML Email Templates ───────────────────────────────────────
// Inline CSS required for email clients

const BASE_STYLES = `
  body { margin:0; padding:0; background:#0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  .wrapper { max-width:560px; margin:0 auto; padding:40px 20px; }
  .card { background:#111118; border:1px solid rgba(255,255,255,0.07); border-radius:12px; padding:32px; }
  .logo { font-size:22px; font-weight:700; color:#e040b0; margin-bottom:28px; display:block; }
  .heading { font-size:20px; font-weight:600; color:#f0eff6; margin:0 0 12px; }
  .body-text { font-size:15px; color:#a8a4b8; line-height:1.7; margin:0 0 24px; }
  .btn { display:inline-block; padding:13px 28px; background:#e040b0; color:#ffffff; text-decoration:none; border-radius:8px; font-size:15px; font-weight:600; }
  .footer { font-size:12px; color:#3d3a4e; margin-top:28px; text-align:center; line-height:1.6; }
  .divider { border:none; border-top:1px solid rgba(255,255,255,0.06); margin:24px 0; }
  .code { background:#0f0f1a; border:1px solid rgba(255,255,255,0.06); border-radius:6px; padding:3px 8px; font-family:monospace; font-size:13px; color:#c0b8d8; }
`;

function passwordResetTemplate({
  username, resetUrl, expiryMinutes,
}: { username: string; resetUrl: string; expiryMinutes: number }) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${BASE_STYLES}</style></head>
<body>
  <div class="wrapper">
    <div class="card">
      <span class="logo">AniRate</span>
      <h1 class="heading">Reset your password</h1>
      <p class="body-text">Hi <strong style="color:#c0b8d8">${escHtml(username)}</strong>,</p>
      <p class="body-text">We received a request to reset your password. Click the button below to choose a new one. This link expires in <span class="code">${expiryMinutes} minutes</span>.</p>
      <a href="${escHtml(resetUrl)}" class="btn">Reset password</a>
      <hr class="divider">
      <p class="body-text" style="font-size:13px">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
    </div>
    <div class="footer">
      AniRate · Sub vs Dub Community Ratings<br>
      <a href="${escHtml(resetUrl)}" style="color:#3d3a4e">Can't click the button? Copy this link</a>
    </div>
  </div>
</body></html>`;
}

function welcomeTemplate({
  username, frontendUrl,
}: { username: string; frontendUrl: string }) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${BASE_STYLES}</style></head>
<body>
  <div class="wrapper">
    <div class="card">
      <span class="logo">AniRate</span>
      <h1 class="heading">Welcome aboard!</h1>
      <p class="body-text">Hi <strong style="color:#c0b8d8">${escHtml(username)}</strong>, your account is ready.</p>
      <p class="body-text">You can now rate anime sub and dub versions, leave comments, and join the community debate on which version reigns supreme.</p>
      <a href="${escHtml(frontendUrl)}" class="btn">Start rating →</a>
    </div>
    <div class="footer">AniRate · Sub vs Dub Community Ratings</div>
  </div>
</body></html>`;
}

function banTemplate({
  username, reason, until,
}: { username: string; reason?: string; until?: Date }) {
  const untilStr = until ? `until ${until.toLocaleDateString()}` : 'permanently';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${BASE_STYLES}</style></head>
<body>
  <div class="wrapper">
    <div class="card">
      <span class="logo">AniRate</span>
      <h1 class="heading" style="color:#ef4444">Account suspended</h1>
      <p class="body-text">Hi <strong style="color:#c0b8d8">${escHtml(username)}</strong>,</p>
      <p class="body-text">Your account has been suspended <strong>${escHtml(untilStr)}</strong>${reason ? ` for the following reason: <em style="color:#c0b8d8">${escHtml(reason)}</em>` : ''}.</p>
      <p class="body-text">If you believe this is a mistake, please contact our support team.</p>
    </div>
    <div class="footer">AniRate · Sub vs Dub Community Ratings</div>
  </div>
</body></html>`;
}

function escHtml(str: string) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
