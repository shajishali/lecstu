import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { isExternalSenderForUniversityInbox, isUniversityEmail } from '../utils/emailDomains';
import {
  getEmailRuntimeConfig,
  getEmailAdminSettings,
  updateEmailRuntimeConfig,
  type EmailRuntimeConfig,
} from './emailConfigStore';

export type EmailServiceMode = 'smtp' | 'console' | 'unconfigured';
export type EmailSmtpProfile = 'default' | 'university';

export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface SendMailResult {
  delivered: boolean;
  mode: EmailServiceMode;
  messageId?: string;
  smtpProfile?: EmailSmtpProfile;
  deliveryWarning?: string;
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
  universitySmtpConfigured: boolean;
  universitySmtpHost: string;
  universitySmtpUser: string;
}

export interface PasswordResetEmailParams {
  to: string;
  firstName?: string | null;
  code: string;
  expiryMinutes: number;
}

export interface ProfilePasswordChangeAdminEmailParams {
  to: string;
  userFullName: string;
  userEmail: string;
  userRole: string;
  code: string;
  expiryMinutes: number;
}

export interface RegistrationVerificationEmailParams {
  to: string;
  firstName?: string | null;
  code: string;
  expiryMinutes: number;
}

let defaultTransporter: Transporter | null = null;
let universityTransporter: Transporter | null = null;

const ENV_PATH = path.resolve(__dirname, '../../.env');

function reloadEnv(): void {
  dotenv.config({ path: ENV_PATH, override: true });
}

function getUniversityRuntimeConfig(): EmailRuntimeConfig {
  reloadEnv();
  return {
    smtpHost: process.env.SMTP_UNIVERSITY_HOST || '',
    smtpPort: parseInt(process.env.SMTP_UNIVERSITY_PORT || '587', 10),
    smtpSecure: process.env.SMTP_UNIVERSITY_SECURE === 'true',
    smtpUser: process.env.SMTP_UNIVERSITY_USER || '',
    smtpPass: process.env.SMTP_UNIVERSITY_PASS || '',
    mailFrom: process.env.SMTP_UNIVERSITY_MAIL_FROM || process.env.MAIL_FROM || 'LECSTU <lecstu.system@gmail.com>',
    smtpDisabled: false,
  };
}

export function isUniversitySmtpConfigured(): boolean {
  const university = getUniversityRuntimeConfig();
  return Boolean(university.smtpHost && university.smtpUser && university.smtpPass);
}

function isProfileConfigured(profile: EmailSmtpProfile, runtime: EmailRuntimeConfig): boolean {
  if (profile === 'university') {
    return isUniversitySmtpConfigured();
  }
  return Boolean(
    !runtime.smtpDisabled && runtime.smtpHost && runtime.smtpUser && runtime.smtpPass,
  );
}

export function resolveSmtpProfile(recipientEmail: string): EmailSmtpProfile {
  if (isUniversitySmtpConfigured() && isUniversityEmail(recipientEmail)) {
    return 'university';
  }
  return 'default';
}

function getRuntimeConfigForProfile(profile: EmailSmtpProfile): EmailRuntimeConfig {
  return profile === 'university' ? getUniversityRuntimeConfig() : getConfig();
}

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
  defaultTransporter = null;
  universityTransporter = null;
}

function clearProfileTransporter(profile: EmailSmtpProfile): void {
  if (profile === 'university') {
    universityTransporter = null;
  } else {
    defaultTransporter = null;
  }
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
  if (isSmtpConfigured() || isUniversitySmtpConfigured()) return 'smtp';
  return 'unconfigured';
}

export function getEmailServiceStatus(): EmailServiceStatus {
  const email = getConfig();
  const admin = getEmailAdminSettings();
  const mode = getEmailServiceMode();
  const senderSource = email.smtpUser || extractFromAddress(email.mailFrom);
  const university = getUniversityRuntimeConfig();

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
    universitySmtpConfigured: isUniversitySmtpConfigured(),
    universitySmtpHost: university.smtpHost,
    universitySmtpUser: university.smtpUser,
  };
}

function getTransporter(profile: EmailSmtpProfile): Transporter {
  const runtime = getRuntimeConfigForProfile(profile);
  if (!isProfileConfigured(profile, runtime)) {
    throw new Error(
      profile === 'university'
        ? 'University SMTP is not configured. Set SMTP_UNIVERSITY_* in server/.env.'
        : 'SMTP is not configured. Set SMTP credentials in Admin Settings or server/.env.',
    );
  }

  if (profile === 'university') {
    if (!universityTransporter) {
      universityTransporter = nodemailer.createTransport({
        host: runtime.smtpHost,
        port: runtime.smtpPort,
        secure: runtime.smtpSecure,
        auth: {
          user: runtime.smtpUser,
          pass: runtime.smtpPass,
        },
      });
    }
    return universityTransporter;
  }

  if (!defaultTransporter) {
    defaultTransporter = nodemailer.createTransport({
      host: runtime.smtpHost,
      port: runtime.smtpPort,
      secure: runtime.smtpSecure,
      auth: {
        user: runtime.smtpUser,
        pass: runtime.smtpPass,
      },
    });
  }
  return defaultTransporter;
}

export async function sendMail(options: SendMailOptions): Promise<SendMailResult> {
  const mode = getEmailServiceMode();
  const smtpProfile = resolveSmtpProfile(options.to);
  const runtime = getRuntimeConfigForProfile(smtpProfile);
  clearProfileTransporter(smtpProfile);
  const deliveryWarning =
    smtpProfile === 'default' &&
    isExternalSenderForUniversityInbox(options.to, runtime.smtpUser || extractFromAddress(runtime.mailFrom))
      ? 'University Outlook may quarantine mail from external senders. Check Junk and Quarantine in Outlook.'
      : undefined;

  if (mode === 'console' || mode === 'unconfigured') {
    console.log('[LECSTU][email] ─── console mode (SMTP disabled or missing credentials) ───');
    console.log(`[LECSTU][email] To: ${options.to}`);
    console.log(`[LECSTU][email] Subject: ${options.subject}`);
    console.log(`[LECSTU][email] Text:\n${options.text}`);
    return {
      delivered: false,
      mode: mode === 'console' ? 'console' : 'unconfigured',
      smtpProfile,
      deliveryWarning,
    };
  }

  const fromAddress = extractFromAddress(runtime.mailFrom);
  try {
    const info = await getTransporter(smtpProfile).sendMail({
      from: runtime.mailFrom,
      to: options.to,
      replyTo: fromAddress,
      envelope: {
        from: runtime.smtpUser || fromAddress,
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
      `[LECSTU][email] Sent to ${options.to} via ${smtpProfile} SMTP` +
        (messageId ? ` (messageId=${messageId})` : ''),
    );
    return {
      delivered: true,
      mode: 'smtp',
      messageId,
      smtpProfile,
      deliveryWarning,
    };
  } catch (err) {
    clearProfileTransporter(smtpProfile);
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
): Promise<SendMailResult> {
  const mail = buildPasswordResetEmail(params);
  return sendMail(mail);
}

export function buildProfilePasswordChangeAdminEmail(
  params: ProfilePasswordChangeAdminEmailParams,
): SendMailOptions {
  const subject = `LECSTU password change approval — ${params.userFullName}`;
  const text = [
    'Hi Admin,',
    '',
    `${params.userFullName} (${params.userEmail}, ${params.userRole}) requested to change their LECSTU password.`,
    '',
    `Approval code: ${params.code}`,
    '',
    `Share this code with the user so they can set a new password. Expires in ${params.expiryMinutes} minutes.`,
    '',
    '— LECSTU Academic Platform',
  ].join('\n');

  const html = `
    <div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;color:#1e293b">
      <p style="font-size:16px">Hi Admin,</p>
      <p style="font-size:15px;line-height:1.5">
        <strong>${params.userFullName}</strong> (${params.userEmail}, ${params.userRole}) verified their current password
        and requested to change it.
      </p>
      <p style="font-size:15px;line-height:1.5">Give them this approval code to enter in My Profile:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:24px 0;padding:16px;background:#f1f5f9;border-radius:8px;text-align:center">${params.code}</p>
      <p style="font-size:14px;color:#64748b">Expires in <strong>${params.expiryMinutes} minutes</strong>.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
      <p style="font-size:12px;color:#94a3b8">LECSTU — AI-Integrated Academic Platform</p>
    </div>
  `.trim();

  return { to: params.to, subject, text, html };
}

export async function sendProfilePasswordChangeAdminEmail(
  params: ProfilePasswordChangeAdminEmailParams,
): Promise<SendMailResult> {
  const mail = buildProfilePasswordChangeAdminEmail(params);
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
): Promise<SendMailResult> {
  const mail = buildRegistrationVerificationEmail(params);
  return sendMail(mail);
}

export async function sendTestEmail(to: string): Promise<SendMailResult> {
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
