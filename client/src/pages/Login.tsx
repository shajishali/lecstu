import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@store/authStore';
import { LogIn, Eye, EyeOff, AlertCircle } from 'lucide-react';
import AuthLayout from '@components/AuthLayout';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');

  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError('');
    clearError();

    if (!email.trim()) return setLocalError('Email is required');
    if (!password) return setLocalError('Password is required');

    try {
      await login({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch {
      // error is set in the store
    }
  };

  const displayError = localError || error;

  return (
    <AuthLayout>
      <div className="w-full max-w-[420px] rounded-xl border border-white/40 bg-white/15 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
        <div className="mb-8 text-center">
          <img src="/logo.png" alt="LECSTU" className="mx-auto h-12 w-auto" />
          <p className="mt-1 font-medium text-slate-900 drop-shadow-sm">Sign in to your account</p>
        </div>

        {displayError && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{displayError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-bold text-slate-900 drop-shadow-sm">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your registered email"
              autoComplete="email"
              autoFocus
              className="w-full rounded-lg border border-slate-300 bg-white/95 px-3.5 py-2.5 text-[15px] font-medium text-slate-900 outline-none transition placeholder:text-slate-600 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/25"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-bold text-slate-900 drop-shadow-sm">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-300 bg-white/95 px-3.5 py-2.5 pr-10 text-[15px] font-medium text-slate-900 outline-none transition placeholder:text-slate-600 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/25"
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

          <button
            type="submit"
            disabled={isLoading}
            className="mt-1 flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-[15px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60 [background-color:var(--color-primary)] hover:[background-color:var(--color-primary-hover)]"
          >
            {isLoading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <>
                <LogIn size={16} />
                Sign In
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm font-medium text-slate-900 drop-shadow-sm">
          Don't have an account? <Link to="/register" className="text-[var(--color-primary)] hover:underline">Register</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
