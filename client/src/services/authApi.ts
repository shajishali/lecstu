import api from './api';

export interface SendRegistrationCodeResult {
  message: string;
  sentToMasked?: string;
  emailDelivered?: boolean;
  devHint?: string;
  devDelivery?: 'smtp' | 'console' | 'unconfigured';
  devVerificationCode?: string;
}

export async function sendRegistrationCode(payload: {
  email: string;
  firstName?: string;
  recoveryEmail?: string;
}): Promise<SendRegistrationCodeResult> {
  const res = await api.post<{
    success: boolean;
    message: string;
    sentToMasked?: string;
    emailDelivered?: boolean;
    devHint?: string;
    devDelivery?: 'smtp' | 'console' | 'unconfigured';
    devVerificationCode?: string;
  }>('/auth/registration/send-code', {
    email: payload.email.trim(),
    firstName: payload.firstName?.trim() || undefined,
    recoveryEmail: payload.recoveryEmail?.trim() || undefined,
  });
  return {
    message: res.data.message,
    sentToMasked: res.data.sentToMasked,
    emailDelivered: res.data.emailDelivered,
    devHint: res.data.devHint,
    devDelivery: res.data.devDelivery,
    devVerificationCode: res.data.devVerificationCode,
  };
}

export async function verifyRegistrationCode(email: string, code: string): Promise<void> {
  await api.post('/auth/registration/verify-code', {
    email: email.trim(),
    code: code.trim(),
  });
}

export interface ForgotPasswordResult {
  message: string;
  sentToMasked?: string;
  emailDelivered?: boolean;
  accountFound?: boolean;
  devHint?: string;
  devDelivery?: 'smtp' | 'console' | 'unconfigured';
  devResetCode?: string;
}

export async function forgotPassword(email: string): Promise<ForgotPasswordResult> {
  const res = await api.post<{
    success: boolean;
    message: string;
    sentToMasked?: string;
    emailDelivered?: boolean;
    accountFound?: boolean;
    devHint?: string;
    devDelivery?: 'smtp' | 'console' | 'unconfigured';
    devResetCode?: string;
  }>('/auth/forgot-password', {
    email: email.trim(),
  });
  return {
    message: res.data.message,
    sentToMasked: res.data.sentToMasked,
    emailDelivered: res.data.emailDelivered,
    accountFound: res.data.accountFound,
    devHint: res.data.devHint,
    devDelivery: res.data.devDelivery,
    devResetCode: res.data.devResetCode,
  };
}

export async function verifyResetCode(email: string, code: string): Promise<void> {
  await api.post('/auth/verify-reset-code', {
    email: email.trim(),
    code: code.trim(),
  });
}

export async function resetPassword(
  email: string,
  code: string,
  newPassword: string,
): Promise<string> {
  const res = await api.post<{ success: boolean; message: string }>('/auth/reset-password', {
    email: email.trim(),
    code: code.trim(),
    newPassword,
  });
  return res.data.message;
}
