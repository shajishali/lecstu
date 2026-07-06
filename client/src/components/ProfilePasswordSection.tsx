import { useRef, useState } from 'react';
import { CheckCircle, Eye, EyeOff, KeyRound, Mail } from 'lucide-react';
import api from '@services/api';
import { showToast } from '@components/Toast';

type Step = 'idle' | 'request' | 'verify' | 'reset' | 'done';

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
  const sectionRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<Step>('idle');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sentToMasked, setSentToMasked] = useState('');
  const [emailDelivered, setEmailDelivered] = useState(false);
  const [deliveryWarning, setDeliveryWarning] = useState('');
  const [devResetCode, setDevResetCode] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [form, setForm] = useState({
    currentPassword: '',
    verificationCode: '',
    newPassword: '',
    confirmPassword: '',
  });

  const goToStep = (next: Step) => {
    setStep(next);
    requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const resetForm = () => {
    setForm({
      currentPassword: '',
      verificationCode: '',
      newPassword: '',
      confirmPassword: '',
    });
    setDevResetCode(null);
    setSentToMasked('');
    setEmailDelivered(false);
    setDeliveryWarning('');
    setSuccessMessage('');
    setStep('idle');
  };

  const handleRequestCode = async () => {
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
        deliveryWarning?: string;
        devResetCode?: string;
      }>('/profile/password/request-code', {
        currentPassword: form.currentPassword,
      });
      setSentToMasked(res.data.sentToMasked ?? '');
      setEmailDelivered(Boolean(res.data.emailDelivered));
      setDeliveryWarning(res.data.deliveryWarning ?? '');
      setDevResetCode(res.data.devResetCode ?? null);
      goToStep('verify');
      if (res.data.emailDelivered) {
        const successMsg =
          res.data.sentToMasked
            ? `Verification code sent to ${res.data.sentToMasked}`
            : res.data.message || 'Verification code sent to your email.';
        showToast('success', successMsg);
        onSuccess(successMsg);
      } else {
        const warnMsg =
          res.data.deliveryWarning ||
          res.data.message ||
          'Email could not be delivered. Use the dev code below or fix SMTP settings.';
        showToast('error', warnMsg);
        onError(warnMsg);
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      const message = ax.response?.data?.message || 'Could not send verification code';
      showToast('error', message);
      onError(message);
    } finally {
      setRequesting(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!/^\d{6}$/.test(form.verificationCode.trim())) {
      showToast('error', 'Enter the 6-digit code from your email');
      onError('Enter the 6-digit code from your email');
      return;
    }
    setVerifying(true);
    try {
      const res = await api.post<{ success: boolean; message: string }>('/profile/password/verify-code', {
        verificationCode: form.verificationCode.trim(),
      });
      goToStep('reset');
      showToast('success', res.data.message || 'Code verified');
      onSuccess(res.data.message || 'Code verified. Set your new password below.');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string } } };
      const message = ax.response?.data?.message || 'Invalid verification code';
      showToast('error', message);
      onError(message);
    } finally {
      setVerifying(false);
    }
  };

  const handleConfirmPassword = async () => {
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
      const msg = res.data.message || 'Password updated successfully';
      setSuccessMessage(msg);
      setForm({
        currentPassword: '',
        verificationCode: '',
        newPassword: '',
        confirmPassword: '',
      });
      setDevResetCode(null);
      setSentToMasked('');
      goToStep('done');
      showToast('success', msg);
      onSuccess(msg);
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
    <div ref={sectionRef} className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
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
            onClick={() => goToStep('request')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <KeyRound size={14} /> Change password
          </button>
        </div>
      )}

      {step === 'request' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Step 1 of 3 — Enter your current password. If it is correct, a 6-digit code will be sent to your
            email (personal Gmail or recovery email).
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleRequestCode();
                  }
                }}
                autoComplete="current-password"
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
              type="button"
              disabled={requesting}
              onClick={() => void handleRequestCode()}
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
        </div>
      )}

      {step === 'verify' && (
        <div className="space-y-4">
          <div
            className={`rounded-lg border px-3 py-2 text-xs ${
              emailDelivered
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            {emailDelivered ? (
              <p>
                Step 2 of 3 — Code sent to <strong>{sentToMasked}</strong>. Check your inbox and spam folder.
              </p>
            ) : (
              <p>
                Step 2 of 3 — Could not deliver email to <strong>{sentToMasked || 'your address'}</strong>.
                {deliveryWarning ? ` ${deliveryWarning}` : ' Check SMTP settings or use the dev code below.'}
              </p>
            )}
            {devResetCode && (
              <p className="mt-1 font-mono text-sm">
                Dev code: <strong>{devResetCode}</strong>
              </p>
            )}
          </div>
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleVerifyCode();
                }
              }}
              placeholder="000000"
              autoFocus
              className={`${inputCls} text-center font-mono tracking-[0.35em]`}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={verifying || form.verificationCode.length !== 6}
              onClick={() => void handleVerifyCode()}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
            >
              {verifying ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <KeyRound size={14} />
              )}
              Verify code
            </button>
            <button
              type="button"
              onClick={() => goToStep('request')}
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
        </div>
      )}

      {step === 'reset' && (
        <div className="space-y-4">
          <p className="text-xs font-medium text-emerald-800">
            Step 3 of 3 — Code verified. Enter your new password below.
          </p>
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
                autoFocus
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleConfirmPassword();
                }
              }}
              autoComplete="new-password"
              className={inputCls}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleConfirmPassword()}
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
              onClick={resetForm}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4 py-2 text-center">
          <CheckCircle size={40} className="mx-auto text-emerald-600" />
          <p className="text-base font-semibold text-slate-800">{successMessage}</p>
          <p className="text-sm text-slate-500">You can continue using LECSTU with your new password.</p>
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
