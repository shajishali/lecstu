import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@store/authStore';
import {
  UserPlus,
  Eye,
  EyeOff,
  AlertCircle,
  Mail,
  CheckCircle,
  ArrowLeft,
} from 'lucide-react';
import AuthLayout from '@components/AuthLayout';
import { useStudentEnrollmentOptions, useEnrollmentFields } from '@hooks/useStudentEnrollmentOptions';
import { sendRegistrationCode, verifyRegistrationCode } from '@services/authApi';
import { showApiErrorToast } from '@services/api';
import type { UserRole } from '../types/auth';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'STUDENT', label: 'Student' },
  { value: 'LECTURER', label: 'Lecturer' },
  { value: 'ADMIN', label: 'Admin' },
];

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white/95 px-3 py-2 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-600 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/25';

const labelClass = 'text-sm font-bold text-slate-900 drop-shadow-sm';
const helperClass = 'text-[11px] leading-snug text-slate-700';
const fieldClass = 'flex flex-col gap-1';
const primaryBtnClass =
  'flex h-[38px] w-full items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]';
const outlineBtnClass =
  'flex h-[38px] w-full items-center justify-center gap-2 rounded-lg border-2 border-[var(--color-primary)] bg-white/95 px-3 text-sm font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-primary-light)] disabled:cursor-not-allowed disabled:opacity-60';
const formStackClass = 'flex flex-col gap-3';

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="mb-3 flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide">
      <span
        className={`rounded-full px-2.5 py-0.5 ${
          step === 1
            ? 'bg-[var(--color-primary)] text-white'
            : 'border border-emerald-300 bg-emerald-50 text-emerald-800'
        }`}
      >
        1. Verify email
      </span>
      <span className="h-px w-6 bg-slate-400" />
      <span
        className={`rounded-full px-2.5 py-0.5 ${
          step === 2
            ? 'bg-[var(--color-primary)] text-white'
            : 'border border-slate-300 bg-white/70 text-slate-600'
        }`}
      >
        2. Account details
      </span>
    </div>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();
  const { programs, loading: optionsLoading } = useStudentEnrollmentOptions();

  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    recoveryEmail: '',
    verificationCode: '',
    password: '',
    confirmPassword: '',
    role: 'STUDENT' as UserRole,
    programCode: '',
    studyYear: '',
    pathwayCode: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [sentToMasked, setSentToMasked] = useState('');
  const [codeHint, setCodeHint] = useState('');
  const [devVerificationCode, setDevVerificationCode] = useState('');

  const { yearOptions, needsPathway, pathwayOptions } = useEnrollmentFields(
    programs,
    form.programCode,
    form.studyYear,
    form.pathwayCode,
  );

  const resetVerification = () => {
    setStep(1);
    setCodeSent(false);
    setEmailVerified(false);
    setSentToMasked('');
    setCodeHint('');
    setDevVerificationCode('');
    setForm((prev) => ({ ...prev, verificationCode: '' }));
  };

  const update = (field: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'role' && value !== 'STUDENT') {
        next.programCode = '';
        next.studyYear = '';
        next.pathwayCode = '';
      }
      if (field === 'programCode') {
        next.studyYear = '';
        next.pathwayCode = '';
      }
      if (field === 'studyYear' && !['Y3', 'Y4'].includes(value)) {
        next.pathwayCode = '';
      }
      if (field === 'email' || field === 'recoveryEmail') {
        next.verificationCode = '';
      }
      return next;
    });
    if (field === 'email' || field === 'recoveryEmail') {
      resetVerification();
    }
    if (field === 'verificationCode') {
      setEmailVerified(false);
    }
    setLocalError('');
    clearError();
  };

  const validateStep1 = (): string | null => {
    if (!form.firstName.trim()) return 'First name is required';
    if (!form.lastName.trim()) return 'Last name is required';
    if (!form.email.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return 'Enter a valid email address';
    }
    if (form.recoveryEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.recoveryEmail.trim())) {
      return 'Enter a valid recovery email';
    }
    return null;
  };

  const handleSendCode = async () => {
    setLocalError('');
    clearError();
    const err = validateStep1();
    if (err) return setLocalError(err);

    setSendingCode(true);
    try {
      const result = await sendRegistrationCode({
        email: form.email.trim(),
        firstName: form.firstName.trim(),
        recoveryEmail: form.recoveryEmail.trim() || undefined,
      });
      setCodeSent(true);
      setSentToMasked(result.sentToMasked ?? '');
      setCodeHint(result.devHint ?? result.message);
      setDevVerificationCode(result.devVerificationCode ?? '');
    } catch (err) {
      showApiErrorToast(err, 'Failed to send verification code');
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    setLocalError('');
    const err = validateStep1();
    if (err) return setLocalError(err);
    if (!/^\d{6}$/.test(form.verificationCode.trim())) {
      return setLocalError('Enter the 6-digit verification code');
    }

    setVerifyingCode(true);
    try {
      await verifyRegistrationCode(form.email.trim(), form.verificationCode.trim());
      setEmailVerified(true);
      setStep(2);
    } catch (err) {
      setEmailVerified(false);
      showApiErrorToast(err, 'Invalid verification code');
    } finally {
      setVerifyingCode(false);
    }
  };

  const validateStep2 = (): string | null => {
    if (!emailVerified || !/^\d{6}$/.test(form.verificationCode.trim())) {
      return 'Email verification is required';
    }
    if (form.password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(form.password)) return 'Password must contain an uppercase letter';
    if (!/[0-9]/.test(form.password)) return 'Password must contain a number';
    if (form.password !== form.confirmPassword) return 'Passwords do not match';
    if (form.role === 'STUDENT') {
      if (!form.programCode) return 'Please select your degree program';
      if (!form.studyYear) return 'Please select your study year';
      if (needsPathway && !form.pathwayCode) {
        return 'Please select your pathway (required for 3rd & 4th year)';
      }
    }
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    const validationError = validateStep2();
    if (validationError) return setLocalError(validationError);

    try {
      await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        verificationCode: form.verificationCode.trim(),
        recoveryEmail: form.recoveryEmail.trim() || undefined,
        password: form.password,
        role: form.role,
        ...(form.role === 'STUDENT' && {
          programCode: form.programCode,
          studyYear: form.studyYear,
          pathwayCode: needsPathway ? form.pathwayCode : undefined,
        }),
      });
      navigate('/dashboard', { replace: true });
    } catch {
      // error is set in the store
    }
  };

  const displayError = localError || error;
  const verifiedEmailLabel = sentToMasked || form.email.trim();

  return (
    <AuthLayout>
      <div className="w-full max-w-[520px] rounded-xl border border-white/40 bg-white/15 p-6 shadow-2xl backdrop-blur-xl sm:p-7">
        <div className="mb-1 text-center">
          <img src="/logo.png" alt="LECSTU" className="mx-auto h-10 w-auto" />
          <p className="mt-0.5 text-[15px] font-medium text-slate-900 drop-shadow-sm">
            {step === 1 ? 'Verify your email' : 'Create your account'}
          </p>
          <p className="mt-1 text-[11px] text-slate-800">
            {step === 1
              ? 'Step 1 of 2 — verify your email to continue.'
              : 'Step 2 of 2 — complete your account details.'}
          </p>
        </div>

        <StepIndicator step={step} />

        {displayError && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{displayError}</span>
          </div>
        )}

        {step === 1 ? (
          <div className={formStackClass}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className={fieldClass}>
                <label htmlFor="firstName" className={labelClass}>
                  First Name
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={form.firstName}
                  onChange={(e) => update('firstName', e.target.value)}
                  placeholder="John"
                  autoFocus
                  className={inputClass}
                />
              </div>
              <div className={fieldClass}>
                <label htmlFor="lastName" className={labelClass}>
                  Last Name
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={form.lastName}
                  onChange={(e) => update('lastName', e.target.value)}
                  placeholder="Doe"
                  className={inputClass}
                />
              </div>
            </div>

            <div className={fieldClass}>
              <label htmlFor="email" className={labelClass}>
                Email (login)
              </label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="student@kln.ac.lk"
                autoComplete="email"
                className={inputClass}
              />
            </div>

            <div className={fieldClass}>
              <label htmlFor="recoveryEmail" className={labelClass}>
                Recovery email <span className="font-normal text-slate-700">(optional)</span>
              </label>
              <input
                id="recoveryEmail"
                type="email"
                value={form.recoveryEmail}
                onChange={(e) => update('recoveryEmail', e.target.value)}
                placeholder="your.personal@gmail.com"
                autoComplete="email"
                className={inputClass}
              />
            </div>

            <div className={`${formStackClass} rounded-lg border border-slate-200/80 bg-white/75 p-3`}>
            <button
              type="button"
              onClick={handleSendCode}
              disabled={sendingCode}
              className={outlineBtnClass}
            >
              {sendingCode ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary)]/30 border-t-[var(--color-primary)]" />
              ) : (
                <>
                  <Mail size={16} />
                  Send verification code
                </>
              )}
            </button>

            {codeSent ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                <div className="flex items-start gap-2">
                  <CheckCircle size={16} className="mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    {sentToMasked ? (
                      <p className="font-medium">Code sent to {sentToMasked}</p>
                    ) : (
                      <p className="font-medium">Verification code sent</p>
                    )}
                    {codeHint ? <p className="mt-1 text-emerald-800">{codeHint}</p> : null}
                    <p className="mt-1 text-emerald-800/90">
                      Check spam or junk if the code doesn&apos;t arrive within a few minutes.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {devVerificationCode ? (
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                  Local dev — verification code
                </p>
                <p className="mt-0.5 font-mono text-lg font-bold tracking-[0.35em] text-slate-900">
                  {devVerificationCode}
                </p>
              </div>
            ) : null}

            <div className={fieldClass}>
              <label htmlFor="verificationCode" className={labelClass}>
                Verification code
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_5.5rem] sm:items-center">
                <input
                  id="verificationCode"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={form.verificationCode}
                  onChange={(e) =>
                    update('verificationCode', e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="000000"
                  className={`${inputClass} text-center font-mono tracking-[0.35em]`}
                />
                <button
                  type="button"
                  onClick={handleVerifyCode}
                  disabled={verifyingCode || form.verificationCode.length !== 6}
                  className={primaryBtnClass}
                >
                  {verifyingCode ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    'Verify'
                  )}
                </button>
              </div>
            </div>

            {emailVerified ? (
              <button type="button" onClick={() => setStep(2)} className={`${primaryBtnClass} h-[38px]`}>
                Continue to account details
              </button>
            ) : null}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={formStackClass}>
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              <CheckCircle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Email verified</p>
                <p className="mt-0.5 text-emerald-800">
                  {form.firstName} {form.lastName} · {verifiedEmailLabel}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex items-center gap-1 self-start text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              <ArrowLeft size={14} />
              Change email
            </button>

            <div className={fieldClass}>
              <label htmlFor="role" className={labelClass}>
                Role
              </label>
              <div className="flex gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => update('role', r.value)}
                    className={`flex-1 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                      form.role === r.value
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] font-semibold [color:var(--color-primary-hover)]'
                        : 'border-slate-300 bg-white/95 text-slate-800 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {form.role === 'STUDENT' && (
              <>
                <p className={`${helperClass} -mt-2`}>
                  Select your current study year and program. Update enrollment from Profile each
                  academic year.
                </p>
                <div className={fieldClass}>
                  <label htmlFor="programCode" className={labelClass}>
                    Degree program (course)
                  </label>
                  <select
                    id="programCode"
                    value={form.programCode}
                    onChange={(e) => update('programCode', e.target.value)}
                    required
                    disabled={optionsLoading}
                    className={inputClass}
                  >
                    <option value="">— Select program —</option>
                    {programs.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.code} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={fieldClass}>
                  <label htmlFor="studyYear" className={labelClass}>
                    Study year
                  </label>
                  <select
                    id="studyYear"
                    value={form.studyYear}
                    onChange={(e) => update('studyYear', e.target.value)}
                    required
                    disabled={!form.programCode}
                    className={inputClass}
                  >
                    <option value="">— Select year —</option>
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y === 'Y1' && 'Y1 — First year'}
                        {y === 'Y2' && 'Y2 — Second year'}
                        {y === 'Y3' && 'Y3 — Third year'}
                        {y === 'Y4' && 'Y4 — Fourth year'}
                        {!['Y1', 'Y2', 'Y3', 'Y4'].includes(y) && y}
                      </option>
                    ))}
                  </select>
                </div>

                {needsPathway && (
                  <div className={fieldClass}>
                    <label htmlFor="pathwayCode" className={labelClass}>
                      Pathway <span className="font-normal text-slate-700">(3rd & 4th year)</span>
                    </label>
                    <select
                      id="pathwayCode"
                      value={form.pathwayCode}
                      onChange={(e) => update('pathwayCode', e.target.value)}
                      required
                      className={inputClass}
                    >
                      <option value="">— Select pathway —</option>
                      {pathwayOptions.map((pw) => (
                        <option key={pw.code} value={pw.code}>
                          {pw.code} — {pw.name}
                        </option>
                      ))}
                    </select>
                    <p className={helperClass}>
                      Links you to the correct timetable group (e.g. CS-Y3-AINT).
                    </p>
                  </div>
                )}
              </>
            )}

            <div className={fieldClass}>
              <label htmlFor="password" className={labelClass}>
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  placeholder="Min 8 chars, 1 uppercase, 1 number"
                  autoComplete="new-password"
                  autoFocus
                  className={`${inputClass} pr-10`}
                />
                <button
                  type="button"
                  className="absolute right-2.5 top-1/2 flex -translate-y-1/2 p-1 text-slate-600 hover:text-slate-800"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className={fieldClass}>
              <label htmlFor="confirmPassword" className={labelClass}>
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={(e) => update('confirmPassword', e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || (form.role === 'STUDENT' && optionsLoading)}
              className={`${primaryBtnClass} mt-0.5`}
            >
              {isLoading ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                <>
                  <UserPlus size={16} />
                  Create Account
                </>
              )}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm font-medium text-slate-900 drop-shadow-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-[var(--color-primary)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
