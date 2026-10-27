// MailService sends the account emails: confirming an address and resetting a
// password. It speaks SMTP, which every delivery provider offers (Resend, Postmark,
// Brevo, SES). Without SMTP settings in development the message is written to the
// log instead, so the links can still be followed locally.
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

type Message = { to: string; subject: string; text: string; html: string };

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transport: Transporter | null = null;
  private from = 'AniRate <no-reply@localhost>';

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const host = this.config.get<string>('SMTP_HOST');
    this.from = this.config.get<string>('SMTP_FROM') ?? this.from;

    if (!host) {
      const warning = 'SMTP_HOST is not set: account emails are written to the log instead of being sent.';
      if (this.config.get<string>('NODE_ENV') === 'production') this.logger.error(warning);
      else this.logger.warn(warning);
      return;
    }

    const port = Number(this.config.get<number>('SMTP_PORT') ?? 587);
    this.transport = createTransport({
      host,
      port,
      // Port 465 speaks TLS from the start; 587 upgrades with STARTTLS.
      secure: port === 465,
      auth: this.config.get<string>('SMTP_USER') ? { user: this.config.get<string>('SMTP_USER'), pass: this.config.get<string>('SMTP_PASS') } : undefined,
    });
  }

  sendEmailVerification(to: string, username: string, link: string) {
    return this.send({
      to,
      subject: 'Confirm your email for AniRate',
      text: `Hi ${username},\n\nConfirm your email address to start rating subs and dubs on AniRate:\n${link}\n\nThe link works for 48 hours. If you did not sign up, ignore this email.`,
      html: layout(
        `Hi ${escape(username)},`,
        'Confirm your email address to start rating subs and dubs on AniRate.',
        link,
        'Confirm my email',
        'The link works for 48 hours. If you did not sign up, ignore this email.',
      ),
    });
  }

  sendPasswordReset(to: string, username: string, link: string) {
    return this.send({
      to,
      subject: 'Reset your AniRate password',
      text: `Hi ${username},\n\nChoose a new password here:\n${link}\n\nThe link works for one hour and can be used once. If you did not ask for this, ignore this email; your password stays the same.`,
      html: layout(
        `Hi ${escape(username)},`,
        'Someone asked to reset the password for your AniRate account. If it was you, choose a new one below.',
        link,
        'Choose a new password',
        'The link works for one hour and can be used once. If you did not ask for this, ignore this email; your password stays the same.',
      ),
    });
  }

  private async send(message: Message) {
    if (!this.transport) {
      this.logger.log(`[email to ${message.to}] ${message.subject}\n${message.text}`);
      return;
    }

    try {
      await this.transport.sendMail({ from: this.from, ...message });
    } catch (error) {
      // A failed send must not reveal to the requester whether the account exists.
      this.logger.error(`Could not send "${message.subject}": ${(error as Error).message}`);
    }
  }
}

function escape(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string);
}

// Plain, table-free markup that reads well in every mail client.
function layout(greeting: string, lede: string, link: string, action: string, footnote: string) {
  return `<!doctype html><html><body style="margin:0;padding:32px 16px;background:#f3f3f1;font-family:Arial,Helvetica,sans-serif;color:#111111">
<div style="max-width:480px;margin:0 auto;background:#ffffff;padding:32px;border:1px solid #d6d6d2">
<p style="margin:0 0 24px;font-weight:bold;font-size:18px">AniRate</p>
<p style="margin:0 0 12px;font-size:16px">${greeting}</p>
<p style="margin:0 0 24px;font-size:16px;line-height:1.5">${lede}</p>
<p style="margin:0 0 24px"><a href="${escape(link)}" style="display:inline-block;background:#111111;color:#ffffff;padding:12px 20px;text-decoration:none;font-weight:bold">${action}</a></p>
<p style="margin:0 0 8px;font-size:13px;color:#686865;line-height:1.5">${footnote}</p>
<p style="margin:0;font-size:12px;color:#686865;word-break:break-all">${escape(link)}</p>
</div></body></html>`;
}
