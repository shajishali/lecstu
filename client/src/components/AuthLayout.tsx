import type { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
}

/**
 * Full-screen background with centered auth form.
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Full-screen background image */}
      <img
        src="/home-bg.png"
        alt="Campus"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-black/40" />

      {/* Centered form */}
      <div className="relative z-10 w-full max-w-[500px] px-4">
        {children}
      </div>
    </div>
  );
}
