import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  getEmailRuntimeConfig,
  getEmailAdminSettings,
  updateEmailRuntimeConfig,
  type EmailRuntimeConfig,
} from './emailConfigStore';

export type EmailServiceMode = 'smtp' | 'console' | 'unconfigured';

export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailServiceStatus {
  label: string;
  mode: EmailServiceMode;
  configured: boolean;
  passwordResetReady: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  mailFrom: string;
  senderMasked: string;
  smtpDisabled: boolean;
  hasAppPassword: boolean;
}

export interface PasswordResetEmailParams {
  to: string;
  firstName?: string | null;
  code: string;
  expiryMinutes: number;
}

export interface RegistrationVerificationEmailParams {
  to: string;
  firstName?: string | null;
  code: string;
  expiryMinutes: number;
}

let transporter: Transporter | null = null;

export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const match = trimmed.match(/^([^@]+)@(.+)$/);
  if (!match) return '••••••••';
  const [, local, domain] = match;
  if (local.length <= 2) return `••@${domain}`;
  return `${local.slice(0, 3)}•••@${domain}`;
}

function extractFromAddress(mailFrom: string): string {
  const angle = mailFrom.match(/<([^>]+)>/);
  return (angle?.[1] || mailFrom).trim();
}

function getConfig(): EmailRuntimeConfig {
  return getEmailRuntimeConfig();
}

export function clearEmailTransporter(): void {
  transporter = null;
}

export function isSmtpConfigured(): boolean {
  const email = getConfig();
  return Boolean(
    !email.smtpDisabled &&
      email.smtpHost &&
      email.smtpUser &&
      email.smtpPass,
  );
}

export function getEmailServiceMode(): EmailServiceMode {
  const email = getConfig();
  if (email.smtpDisabled) return 'console';
  if (isSmtpConfigured()) return 'smtp';
  return 'unconfigured';
}

export function getEmailServiceStatus(): EmailServiceStatus {
  const email = getConfig();
  const admin = getEmailAdminSettings();
  const mode = getEmailServiceMode();
  const senderSource = email.smtpUser || extractFromAddress(email.mailFrom);

  return {
    label: 'Email (password reset)',
    mode,
    configured: mode === 'smtp',
    passwordResetReady: mode === 'smtp' || mode === 'console',
    smtpHost: email.smtpHost || (mode === 'console' ? '(console log)' : ''),
    smtpPort: email.smtpPort,
    smtpSecure: email.smtpSecure,
    smtpUser: email.smtpUser,
    mailFrom: email.mailFrom,
    senderMasked: senderSource ? maskEmail(senderSource) : 'Not configured',
    smtpDisabled: email.smtpDisabled,
    hasAppPassword: admin.hasAppPassword,
  };
}

function getTransporter(): Transporter {
  if (!isSmtpConfigured()) {
    throw new Error('SMTP is not configured. Set SMTP credentials in Admin Settings or server/.env.');
  }
  if (!transporter) {
    const email = getConfig();
    transporter = nodemailer.createTransport({
      host: email.smtpHost,
      port: email.smtpPort,
      secure: email.smtpSecure,
      auth: {
        user: email.smtpUser,
        pass: email.smtpPass,
      },
    });
  }
  return transporter;
}

export async function sendMail(options: SendMailOptions): Promise<{ delivered: boolean; mode: EmailServiceMode; messageId?: string }> {
  clearEmailTransporter();
  const mode = getEmailServiceMode();

  if (mode === 'console' || mode === 'unconfigured') {
    console.log('[LECSTU][email] ─── console mode (SMTP disabled or missing credentials) ───');
    console.log(`[LECSTU][email] To: ${options.to}`);
    console.log(`[LECSTU][email] Subject: ${options.subject}`);
    console.log(`[LECSTU][email] Text:\n${options.text}`);
    return { delivered: false, mode: mode === 'console' ? 'console' : 'unconfigured' };
  }

  const email = getConfig();
  const fromAddress = extractFromAddress(email.mailFrom);
  try {
    const info = await getTransporter().sendMail({
      from: email.mailFrom,
      to: options.to,
      replyTo: fromAddress,
      envelope: {
        from: email.smtpUser || fromAddress,
        to: options.to,
      },
      subject: options.subject,
      text: options.text,
      html: options.html,
      priority: 'normal',
      headers: {
        'X-Mailer': 'LECSTU Platform',
        'Auto-Submitted': 'auto-generated',
        'X-Auto-Response-Suppress': 'All',
      },
    });
    const messageId = typeof info.messageId === 'string' ? info.messageId : undefined;
    console.log(
      `[LECSTU][email] Sent to ${options.to} via SMTP` +
        (messageId ? ` (messageId=${messageId})` : ''),
    );
    return { delivered: true, mode: 'smtp', messageId };
  } catch (err) {
    clearEmailTransporter();
    throw err;
  }
}

export function buildPasswordResetEmail(params: PasswordResetEmailParams): SendMailOptions {
  const greeting = params.firstName?.trim() ? `Hi ${params.firstName.trim()},` : 'Hi,';
  const subject = 'LECSTU password reset code';
  const text = [
    greeting,
    '',
    `Your LECSTU password reset code is: ${params.code}`,
    '',
    `This code expires in ${params.expiryMinutes} minutes.`,
    'If you did not request a password reset, you can ignore this email.',
    '',
    '— LECSTU Academic Platform',
  ].join('\n');

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1e293b">
      <p style="font-size:16px">${greeting}</p>
      <p style="font-size:15px;line-height:1.5">Use this code to reset your LECSTU password:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:24px 0;padding:16px;background:#f1f5f9;border-radius:8px;text-align:center">${params.code}</p>
      <p style="font-size:14px;color:#64748b">Expires in <strong>${params.expiryMinutes} minutes</strong>.</p>
      <p style="font-size:13px;color:#94a3b8;margin-top:24px">If you did not request this, ignore this email.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
      <p style="font-size:12px;color:#94a3b8">LECSTU — AI-Integrated Academic Platform</p>
    </div>
  `.trim();

  return { to: params.to, subject, text, html };
}

export async function sendPasswordResetCodeEmail(
  params: PasswordResetEmailParams,
): Promise<{ delivered: boolean; mode: EmailServiceMode }> {
  const mail = buildPasswordResetEmail(params);
  return sendMail(mail);
}

export function buildRegistrationVerificationEmail(
  params: RegistrationVerificationEmailParams,
): SendMailOptions {
  const greeting = params.firstName?.trim() ? `Hi ${params.firstName.trim()},` : 'Hi,';
  const subject = 'LECSTU registration verification code';
  const text = [
    greeting,
    '',
    `Your LECSTU registration verification code is: ${params.code}`,
    '',
    `This code expires in ${params.expiryMinutes} minutes.`,
    'If you did not start registration, you can ignore this email.',
    '',
    '— LECSTU Academic Platform',
  ].join('\n');

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1e293b">
      <p style="font-size:16px">${greeting}</p>
      <p style="font-size:15px;line-height:1.5">Use this code to verify your email and complete LECSTU registration:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:24px 0;padding:16px;background:#f1f5f9;border-radius:8px;text-align:center">${params.code}</p>
      <p style="font-size:14px;color:#64748b">Expires in <strong>${params.expiryMinutes} minutes</strong>.</p>
      <p style="font-size:13px;color:#94a3b8;margin-top:24px">If you did not start registration, ignore this email.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
      <p style="font-size:12px;color:#94a3b8">LECSTU — AI-Integrated Academic Platform</p>
    </div>
  `.trim();

  return { to: params.to, subject, text, html };
}

export async function sendRegistrationVerificationEmail(
  params: RegistrationVerificationEmailParams,
): Promise<{ delivered: boolean; mode: EmailServiceMode }> {
  const mail = buildRegistrationVerificationEmail(params);
  return sendMail(mail);
}

export async function sendTestEmail(to: string): Promise<{ delivered: boolean; mode: EmailServiceMode }> {
  const code = '123456';
  return sendPasswordResetCodeEmail({
    to,
    firstName: 'Admin',
    code,
    expiryMinutes: 15,
  });
}

export function saveEmailAdminSettings(
  patch: Partial<EmailRuntimeConfig>,
): EmailServiceStatus {
  clearEmailTransporter();
  updateEmailRuntimeConfig(patch);
  return getEmailServiceStatus();
}
