import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, KeyRound, Mail } from 'lucide-react';
import api from '@services/api';
import { showToast } from '@components/Toast';

type Step = 'idle' | 'request' | 'confirm';

interface Props {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  inputCls?: string;
}

export default function ProfilePasswordSection({
  onSuccess,
  onError,
  inputCls = 'w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]',
}: Props) {
  const [step, setStep] = useState<Step>('idle');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [sentToMasked, setSentToMasked] = useState('');
  const [devResetCode, setDevResetCode] = useState<string | null>(null);
  const [form, setForm] = useState({
    currentPassword: '',
    verificationCode: '',
    newPassword: '',
    confirmPassword: '',
  });

  const resetForm = () => {
    setForm({
      currentPassword: '',
      verificationCode: '',
      newPassword: '',
      confirmPassword: '',
    });
    setDevResetCode(null);
    setSentToMasked('');
    setCodeSent(false);
    setStep('idle');
  };

  const handleRequestCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.currentPassword.trim()) {
      showToast('error', 'Enter your current password');
      onError('Enter your current password');
      return;
    }
    setRequesting(true);
    try {
      const res = await api.post<{
        success: boolean;
        message: string;
        sentToMasked?: string;
        emailDelivered?: boolean;
        devResetCode?: string;
        devHint?: string;
      }>('/profile/password/request-code', {
        currentPassword: form.currentPassword,
      });
      setCodeSent(true);
      setSentToMasked(res.data.sentToMasked ?? '');
      setStep('confirm');
      setDevResetCode(res.data.devResetCode ?? null);
      const successMsg =
        res.data.sentToMasked && res.data.emailDelivered
          ? `Verification code sent to ${res.data.sentToMasked}`
          : res.data.message || 'Verification code sent to your email.';
      onSuccess(successMsg);
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string }; status?: number } };
      const message = ax.response?.data?.message || 'Could not send verification code';
      showToast('error', message);
      onError(message);
    } finally {
      setRequesting(false);
    }
  };

  const handleConfirmPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(form.verificationCode.trim())) {
      showToast('error', 'Enter the 6-digit code from your email');
      onError('Enter the 6-digit code from your email');
      return;
    }
    if (form.newPassword.length < 8) {
      showToast('error', 'Password must be at least 8 characters');
      onError('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(form.newPassword)) {
      showToast('error', 'Password must contain an uppercase letter');
      onError('Password must contain an uppercase letter');
      return;
    }
    if (!/[0-9]/.test(form.newPassword)) {
      showToast('error', 'Password must contain a number');
      onError('Password must contain a number');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      showToast('error', 'New passwords do not match');
      onError('New passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const res = await api.patch<{ success: boolean; message: string }>('/profile/password/confirm', {
        verificationCode: form.verificationCode.trim(),
        newPassword: form.newPassword,
      });
      resetForm();
      showToast('success', res.data.message || 'Password updated successfully');
      onSuccess(res.data.message || 'Password updated successfully');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      const message = ax.response?.data?.message || 'Failed to update password';
      showToast('error', message);
      onError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
      <div className="mb-3 flex items-center gap-2">
        <KeyRound size={16} className="text-[var(--color-primary)]" />
        <h3 className="text-sm font-semibold text-slate-800">Password</h3>
      </div>

      {step === 'idle' && (
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pPasswordPlaceholder" className="text-sm font-semibold text-slate-700">
              Current password
            </label>
            <input
              id="pPasswordPlaceholder"
              type="password"
              value="••••••••"
              disabled
              className={`${inputCls} disabled:bg-slate-100 disabled:text-slate-500`}
              aria-label="Password is set"
            />
            <p className="text-xs text-slate-500">Your password is stored securely and cannot be displayed.</p>
          </div>
          <button
            type="button"
            onClick={() => setStep('request')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <KeyRound size={14} /> Change password
          </button>
        </div>
      )}

      {step === 'request' && (
        <form onSubmit={handleRequestCode} className="space-y-4">
          <p className="text-xs text-slate-600">
            Enter your current password. If it is correct, a 6-digit code will be sent to your email
            (personal Gmail or recovery email). Enter that code below to set a new password.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pCurrentPassword" className="text-sm font-semibold text-slate-700">
              Current password
            </label>
            <div className="relative">
              <input
                id="pCurrentPassword"
                type={showCurrent ? 'text' : 'password'}
                value={form.currentPassword}
                onChange={(e) => setForm((p) => ({ ...p, currentPassword: e.target.value }))}
                autoComplete="current-password"
                required
                className={`${inputCls} pr-10`}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                onClick={() => setShowCurrent((v) => !v)}
                tabIndex={-1}
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={requesting}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
            >
              {requesting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <Mail size={14} />
              )}
              Send code to email
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {step === 'confirm' && (
        <form onSubmit={handleConfirmPassword} className="space-y-4">
          {codeSent && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              {sentToMasked ? (
                <p>Code sent to <strong>{sentToMasked}</strong>. Check your inbox and spam folder.</p>
              ) : (
                <p>Verification code sent. Check your email inbox and spam folder.</p>
              )}
              {devResetCode && (
                <p className="mt-1 font-mono text-sm">
                  Dev code: <strong>{devResetCode}</strong>
                </p>
              )}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pVerificationCode" className="text-sm font-semibold text-slate-700">
              Verification code
            </label>
            <input
              id="pVerificationCode"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={form.verificationCode}
              onChange={(e) =>
                setForm((p) => ({ ...p, verificationCode: e.target.value.replace(/\D/g, '').slice(0, 6) }))
              }
              placeholder="6-digit code"
              required
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pNewPassword" className="text-sm font-semibold text-slate-700">
              New password
            </label>
            <div className="relative">
              <input
                id="pNewPassword"
                type={showNew ? 'text' : 'password'}
                value={form.newPassword}
                onChange={(e) => setForm((p) => ({ ...p, newPassword: e.target.value }))}
                autoComplete="new-password"
                required
                minLength={8}
                className={`${inputCls} pr-10`}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                onClick={() => setShowNew((v) => !v)}
                tabIndex={-1}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              At least 8 characters with one uppercase letter and one number.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pConfirmPassword" className="text-sm font-semibold text-slate-700">
              Confirm new password
            </label>
            <input
              id="pConfirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
              autoComplete="new-password"
              required
              className={inputCls}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
            >
              {saving ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <KeyRound size={14} />
              )}
              Update password
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('request');
                setForm((p) => ({
                  ...p,
                  verificationCode: '',
                  newPassword: '',
                  confirmPassword: '',
                }));
              }}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Resend code
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
