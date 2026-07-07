import { useState, type FormEvent, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Eye, EyeOff, KeyRound, Lock } from 'lucide-react';
import AuthLayout from '@components/AuthLayout';
import { resetPassword, verifyResetCode } from '@services/authApi';
import { showApiErrorToast } from '@services/api';
import { showToast } from '@components/Toast';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white/95 px-3.5 py-2.5 text-[15px] font-medium text-slate-900 outline-none transition placeholder:text-slate-600 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/25';

function normalizeCodeInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6);
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fromQuery = searchParams.get('email');
    if (fromQuery) setEmail(fromQuery);
  }, [searchParams]);

  const validatePassword = (): string | null => {
    if (newPassword.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(newPassword)) return 'Password must contain an uppercase letter';
    if (!/[0-9]/.test(newPassword)) return 'Password must contain a number';
    if (newPassword !== confirmPassword) return 'Passwords do not match';
    return null;
  };

  const handleVerifyStep = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');

    if (!email.trim()) return setLocalError('Email is required');
    if (code.length !== 6) return setLocalError('Enter the 6-digit code from your email');

    setIsLoading(true);
    try {
      await verifyResetCode(email.trim(), code);
      setStep(2);
    } catch (err) {
      showApiErrorToast(err, 'Invalid or expired reset code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');

    const passwordError = validatePassword();
    if (passwordError) return setLocalError(passwordError);

    setIsLoading(true);
    try {
      const message = await resetPassword(email.trim(), code, newPassword);
      showToast('success', message || 'Password updated - sign in with your new password');
      navigate('/login', { replace: true });
    } catch (err) {
      showApiErrorToast(err, 'Failed to reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = normalizeCodeInput(e.clipboardData.getData('text'));
    setCode(pasted);
  };

  return (
    <AuthLayout>
      <div className="w-full max-w-[420px] rounded-xl border border-white/40 bg-white/15 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
        <div className="mb-8 text-center">
          <img src="/logo.png" alt="LECSTU" className="mx-auto h-12 w-auto" />
          <p className="mt-1 font-medium text-slate-900 drop-shadow-sm">Reset your password</p>
          <p className="mt-2 text-sm text-slate-800">
            {step === 1
              ? 'Enter the code we sent to your email.'
              : 'Choose a new password for your account.'}
          </p>
          {step === 1 ? (
            <p className="mt-1 text-xs text-slate-700">
              Check spam or junk mail if you don&apos;t see the code within a few minutes.
            </p>
          ) : null}
        </div>

        {localError && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{localError}</span>
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleVerifyStep} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="resetEmail" className="text-sm font-bold text-slate-900 drop-shadow-sm">
                Email
              </label>
              <input
                id="resetEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className={inputClass}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="resetCode" className="text-sm font-bold text-slate-900 drop-shadow-sm">
                Reset code
              </label>
              <input
                id="resetCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(normalizeCodeInput(e.target.value))}
                onPaste={handleCodePaste}
                placeholder="6-digit code"
                maxLength={6}
                className={`${inputClass} text-center text-lg tracking-[0.35em] font-semibold`}
                required
              />
              <p className="text-xs text-slate-600">
                Code expires in 15 minutes. Didn&apos;t get one?{' '}
                <Link to="/forgot-password" className="text-[var(--color-primary)] hover:underline">
                  Request again
                </Link>
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
            >
              {isLoading ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  <KeyRound size={16} />
                  Continue
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="newPassword" className="text-sm font-bold text-slate-900 drop-shadow-sm">
                New password
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className={`${inputClass} pr-10`}
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex p-1 text-slate-600 hover:text-slate-800"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-slate-600">
                At least 8 characters, one uppercase letter, and one number.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmPassword" className="text-sm font-bold text-slate-900 drop-shadow-sm">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className={inputClass}
                required
              />
            </div>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-left text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              ← Back to code entry
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
            >
              {isLoading ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  <Lock size={16} />
                  Update password
                </>
              )}
            </button>
          </form>
        )}

        <Link
          to="/login"
          className="mt-6 flex items-center justify-center gap-1 text-sm font-medium text-slate-900 drop-shadow-sm hover:text-[var(--color-primary)]"
        >
          <ArrowLeft size={14} />
          Back to sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
