import { config } from '../config';

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase();
}

export function extractEmailDomain(email: string): string | null {
  const match = email.trim().toLowerCase().match(/@([^@]+)$/);
  return match ? normalizeDomain(match[1]) : null;
}

export function isUniversityEmail(email: string): boolean {
  const domain = extractEmailDomain(email);
  if (!domain) return false;
  return config.email.universityDomains.some(
    (universityDomain) => domain === universityDomain || domain.endsWith(`.${universityDomain}`),
  );
}

export function isExternalSenderForUniversityInbox(
  recipientEmail: string,
  senderEmail: string,
): boolean {
  if (!isUniversityEmail(recipientEmail)) return false;
  const senderDomain = extractEmailDomain(senderEmail);
  if (!senderDomain) return true;
  return !config.email.universityDomains.some(
    (universityDomain) =>
      senderDomain === universityDomain || senderDomain.endsWith(`.${universityDomain}`),
  );
}

export function getUniversityDeliveryWarning(recipientEmail: string): string | null {
  if (!isUniversityEmail(recipientEmail)) return null;
  return (
    'University Outlook mail often quarantines codes sent from external Gmail senders. ' +
    'Check Junk, Spam, and your Quarantine folder in Outlook. ' +
    'If nothing arrives within a few minutes, use the code shown below (development) or ask IT to enable the LECSTU sender mailbox.'
  );
}

export function needsRecoveryEmailForCodeDelivery(
  recoveryEmail: string | null | undefined,
): boolean {
  return !recoveryEmail?.trim();
}

export function getRecoveryEmailRequiredMessage(): string {
  return (
    'A personal recovery email is required. Verification codes are sent to your personal Gmail ' +
    '(not your university Outlook inbox). Use an address different from your login email.'
  );
}
