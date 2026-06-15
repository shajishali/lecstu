import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@store/authStore';
import { UserPlus, Eye, EyeOff, AlertCircle } from 'lucide-react';
import AuthLayout from '@components/AuthLayout';
import { useStudentEnrollmentOptions, useEnrollmentFields } from '@hooks/useStudentEnrollmentOptions';
import type { UserRole } from '../types/auth';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'STUDENT', label: 'Student' },
  { value: 'LECTURER', label: 'Lecturer' },
  { value: 'ADMIN', label: 'Admin' },
];

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white/95 px-3.5 py-2.5 text-[15px] font-medium text-slate-900 outline-none transition placeholder:text-slate-600 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/25';

export default function Register() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();
  const { programs, loading: optionsLoading } = useStudentEnrollmentOptions();

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'STUDENT' as UserRole,
    programCode: '',
    studyYear: '',
    pathwayCode: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const { yearOptions, needsPathway, pathwayOptions } = useEnrollmentFields(
    programs,
    form.programCode,
    form.studyYear,
    form.pathwayCode,
  );

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
      return next;
    });
    setLocalError('');
    clearError();
  };

  const validate = (): string | null => {
    if (!form.firstName.trim()) return 'First name is required';
    if (!form.lastName.trim()) return 'Last name is required';
    if (!form.email.trim()) return 'Email is required';
    if (form.password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(form.password)) return 'Password must contain an uppercase letter';
    if (!/[0-9]/.test(form.password)) return 'Password must contain a number';
    if (form.password !== form.confirmPassword) return 'Passwords do not match';
    if (form.role === 'STUDENT') {
      if (!form.programCode) return 'Please select your degree program';
      if (!form.studyYear) return 'Please select your study year';
      if (needsPathway && !form.pathwayCode) return 'Please select your pathway (required for 3rd & 4th year)';
    }
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    const validationError = validate();
    if (validationError) return setLocalError(validationError);

    try {
      await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
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

  return (
    <AuthLayout>
      <div className="w-full max-w-[500px] rounded-xl border border-white/40 bg-white/15 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
        <div className="mb-8 text-center">
          <img src="/logo.png" alt="LECSTU" className="mx-auto h-12 w-auto" />
          <p className="mt-1 font-medium text-slate-900 drop-shadow-sm">Create your account</p>
          {form.role === 'STUDENT' && (
            <p className="mt-2 text-xs text-slate-800">
              Select your current study year and program. Each academic year, sign in and update
              enrollment from your profile.
            </p>
          )}
        </div>

        {displayError && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{displayError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="firstName" className="text-sm font-bold text-slate-900 drop-shadow-sm">
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
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lastName" className="text-sm font-bold text-slate-900 drop-shadow-sm">
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

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-bold text-slate-900 drop-shadow-sm">
              Email
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

          <div className="flex flex-col gap-1.5">
            <label htmlFor="role" className="text-sm font-bold text-slate-900 drop-shadow-sm">
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
              <div className="flex flex-col gap-1.5">
                <label htmlFor="programCode" className="text-sm font-bold text-slate-900 drop-shadow-sm">
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

              <div className="flex flex-col gap-1.5">
                <label htmlFor="studyYear" className="text-sm font-bold text-slate-900 drop-shadow-sm">
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
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="pathwayCode" className="text-sm font-bold text-slate-900 drop-shadow-sm">
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
                  <p className="text-xs text-slate-700">
                    Links you to the correct timetable group (e.g. CS-Y3-AINT).
                  </p>
                </div>
              )}
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-bold text-slate-900 drop-shadow-sm">
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
                className={`${inputClass} pr-10`}
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
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmPassword" className="text-sm font-bold text-slate-900 drop-shadow-sm">
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
            className="mt-1 flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-[15px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
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

        <p className="mt-6 text-center text-sm font-medium text-slate-900 drop-shadow-sm">
          Already have an account? <Link to="/login" className="text-[var(--color-primary)] hover:underline">Sign in</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
