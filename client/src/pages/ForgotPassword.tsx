import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle, Mail } from 'lucide-react';
import AuthLayout from '@components/AuthLayout';
import { forgotPassword } from '@services/authApi';
import { showApiErrorToast } from '@services/api';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white/95 px-3.5 py-2.5 text-[15px] font-medium text-slate-900 outline-none transition placeholder:text-slate-600 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/25';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [localError, setLocalError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [devHint, setDevHint] = useState('');
  const [devDelivery, setDevDelivery] = useState<'smtp' | 'console' | 'unconfigured' | null>(null);
  const [sentToMasked, setSentToMasked] = useState('');
  const [devResetCode, setDevResetCode] = useState('');
  const [emailDelivered, setEmailDelivered] = useState(false);
  const [accountFound, setAccountFound] = useState<boolean | null>(null);
  const [deliveryWarning, setDeliveryWarning] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!email.trim()) {
      setLocalError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setLocalError('Enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      const result = await forgotPassword(email.trim());
      setSuccessMessage(result.message);
      setDevHint(result.devHint ?? '');
      setDevDelivery(result.devDelivery ?? null);
      setSentToMasked(result.sentToMasked ?? '');
      setDevResetCode(result.devResetCode ?? '');
      setEmailDelivered(result.emailDelivered === true);
      setAccountFound(result.accountFound ?? null);
      setDeliveryWarning(result.deliveryWarning ?? '');
      setSubmitted(true);
    } catch (err) {
      showApiErrorToast(err, 'Failed to send reset code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-[420px] rounded-xl border border-white/40 bg-white/15 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
        <div className="mb-8 text-center">
          <img src="/logo.png" alt="LECSTU" className="mx-auto h-12 w-auto" />
          <p className="mt-1 font-medium text-slate-900 drop-shadow-sm">Forgot your password?</p>
          <p className="mt-2 text-sm text-slate-800">
            Enter the email you registered with. We&apos;ll send a 6-digit reset code to your
            recovery email if you set one in Profile.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-5">
            {(() => {
              const showWarning =
                accountFound === false ||
                devDelivery === 'console' ||
                devDelivery === 'unconfigured' ||
                (accountFound === true && !emailDelivered && !devResetCode);
              return (
            <div
              className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
                showWarning
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}
            >
              {showWarning ? (
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
              ) : (
                <CheckCircle size={18} className="mt-0.5 shrink-0" />
              )}
              <div>
                <p className="font-medium">
                  {accountFound === false
                    ? 'No account for this email'
                    : showWarning
                      ? 'Email may not have been sent'
                      : 'Check your email'}
                </p>
                <p className="mt-1">{successMessage}</p>
                {sentToMasked ? (
                  <p className="mt-2 font-semibold">
                    Code sent to <span className="font-mono">{sentToMasked}</span>
                  </p>
                ) : null}
                {devHint ? (
                  <p className="mt-2 font-medium">{devHint}</p>
                ) : null}
                {deliveryWarning ? (
                  <p className="mt-2 font-medium">{deliveryWarning}</p>
                ) : null}
                <p className="mt-2 text-slate-700/90">
                  Didn&apos;t receive it within a few minutes? Check your spam or junk folder.
                  University mail (@stu.kln.ac.lk) often quarantines external senders — use a personal
                  recovery email in Profile if needed.
                </p>
              </div>
            </div>
              );
            })()}
            {devResetCode ? (
              <div className="rounded-lg border border-slate-200 bg-white/80 px-4 py-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Development — use this reset code
                </p>
                <p className="mt-2 font-mono text-2xl font-bold tracking-[0.35em] text-slate-900">
                  {devResetCode}
                </p>
                <p className="mt-2 text-xs text-slate-600">
                  Shown while running locally so password reset works even if university Outlook
                  quarantines the email.
                </p>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() =>
                navigate(`/reset-password?email=${encodeURIComponent(email.trim())}`)
              }
              className="flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-[15px] font-semibold text-white [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
            >
              Enter reset code
            </button>
            <Link
              to="/login"
              className="flex items-center justify-center gap-1 text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              <ArrowLeft size={14} />
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            {localError && (
              <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{localError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="forgotEmail" className="text-sm font-bold text-slate-900 drop-shadow-sm">
                  Registered email
                </label>
                <input
                  id="forgotEmail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  autoComplete="email"
                  autoFocus
                  className={inputClass}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="mt-1 flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-[15px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
              >
                {isLoading ? (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <Mail size={16} />
                    Send reset code
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-sm font-medium text-slate-900 drop-shadow-sm">
              Remember your password?{' '}
              <Link to="/login" className="text-[var(--color-primary)] hover:underline">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
