import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, KeyRound, Mail } from 'lucide-react';
import api, { showApiErrorToast } from '@services/api';

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
    setCodeSent(false);
    setStep('idle');
  };

  const handleRequestCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.currentPassword.trim()) {
      onError('Enter your current password');
      return;
    }
    setRequesting(true);
    try {
      const res = await api.post<{
        success: boolean;
        message: string;
        devResetCode?: string;
      }>('/profile/password/request-code', {
        currentPassword: form.currentPassword,
      });
      setCodeSent(true);
      setStep('confirm');
      setDevResetCode(res.data.devResetCode ?? null);
      onSuccess(res.data.message || 'Verification code sent to the administrator.');
    } catch (err: unknown) {
      showApiErrorToast(err, 'Could not send verification code');
      const ax = err as { response?: { data?: { message?: string } } };
      onError(ax.response?.data?.message || 'Could not send verification code');
    } finally {
      setRequesting(false);
    }
  };

  const handleConfirmPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(form.verificationCode.trim())) {
      onError('Enter the 6-digit code from your administrator');
      return;
    }
    if (form.newPassword.length < 8) {
      onError('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(form.newPassword)) {
      onError('Password must contain an uppercase letter');
      return;
    }
    if (!/[0-9]/.test(form.newPassword)) {
      onError('Password must contain a number');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
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
      onSuccess(res.data.message || 'Password updated successfully');
    } catch (err: unknown) {
      showApiErrorToast(err, 'Failed to update password');
      const ax = err as { response?: { data?: { message?: string } } };
      onError(ax.response?.data?.message || 'Failed to update password');
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
            Enter your current password. A verification code will be emailed to the administrator.
            After you receive the code, you can set a new password.
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
              Send code to admin
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
              Code requested. Ask your administrator for the 6-digit code sent to their email.
              {devResetCode && (
                <p className="mt-1 font-mono text-sm">
                  Dev code: <strong>{devResetCode}</strong>
                </p>
              )}
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="pVerificationCode" className="text-sm font-semibold text-slate-700">
              Admin verification code
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
