import { useEffect, useMemo, useState, type ReactNode } from 'react';
import api from '@services/api';

interface AuthLayoutProps {
  children: ReactNode;
}

const DEFAULT_LOGIN_BACKGROUND_URL = '/home-bg.png';
const DEFAULT_APPEARANCE = {
  loginBackgroundUrl: DEFAULT_LOGIN_BACKGROUND_URL,
  loginBackgroundFit: 'contain',
  loginBackgroundPositionX: 50,
  loginBackgroundPositionY: 50,
  loginBackgroundScale: 100,
  loginBackgroundDesktopFit: 'contain',
  loginBackgroundDesktopPositionX: 50,
  loginBackgroundDesktopPositionY: 50,
  loginBackgroundDesktopScale: 100,
  loginBackgroundMobileFit: 'contain',
  loginBackgroundMobilePositionX: 50,
  loginBackgroundMobilePositionY: 50,
  loginBackgroundMobileScale: 100,
} as const;

interface LoginBackgroundAppearance {
  loginBackgroundUrl: string;
  loginBackgroundFit: 'cover' | 'contain' | 'fill';
  loginBackgroundPositionX: number;
  loginBackgroundPositionY: number;
  loginBackgroundScale: number;
  loginBackgroundDesktopFit: 'cover' | 'contain' | 'fill';
  loginBackgroundDesktopPositionX: number;
  loginBackgroundDesktopPositionY: number;
  loginBackgroundDesktopScale: number;
  loginBackgroundMobileFit: 'cover' | 'contain' | 'fill';
  loginBackgroundMobilePositionX: number;
  loginBackgroundMobilePositionY: number;
  loginBackgroundMobileScale: number;
}

/**
 * Full-screen background with centered auth form.
 */
export default function AuthLayout({ children }: AuthLayoutProps) {
  const [appearance, setAppearance] = useState<LoginBackgroundAppearance>(DEFAULT_APPEARANCE);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 640px)').matches);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)');
    const handleChange = () => setIsMobile(media.matches);
    handleChange();
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const activeBackground = useMemo(
    () =>
      isMobile
        ? {
            fit: appearance.loginBackgroundMobileFit,
            positionX: appearance.loginBackgroundMobilePositionX,
            positionY: appearance.loginBackgroundMobilePositionY,
            scale: appearance.loginBackgroundMobileScale,
          }
        : {
            fit: appearance.loginBackgroundDesktopFit,
            positionX: appearance.loginBackgroundDesktopPositionX,
            positionY: appearance.loginBackgroundDesktopPositionY,
            scale: appearance.loginBackgroundDesktopScale,
          },
    [appearance, isMobile],
  );
  const position = `${activeBackground.positionX}% ${activeBackground.positionY}%`;
  const scale = `scale(${activeBackground.scale / 100})`;

  useEffect(() => {
    let alive = true;
    const loadAppearance = (useDefaultOnError = false) =>
      api
        .get<{ success: boolean; data?: { appearance?: { loginBackgroundUrl?: string } } }>(
          '/settings/public',
          { params: { _: Date.now() } },
        )
      .then((res) => {
        const nextAppearance = res.data.data?.appearance as LoginBackgroundAppearance | undefined;
        if (alive && nextAppearance?.loginBackgroundUrl) {
          setAppearance({
            ...DEFAULT_APPEARANCE,
            ...nextAppearance,
          });
        }
      })
      .catch(() => {
        if (alive && useDefaultOnError) setAppearance(DEFAULT_APPEARANCE);
      });

    void loadAppearance(true);

    // An already-open login tab must pick up changes saved in Admin settings
    // when the user switches back to it.
    const refreshOnFocus = () => void loadAppearance();
    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') refreshOnFocus();
    };
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnVisible);

    return () => {
      alive = false;
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnVisible);
    };
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950">
      <img
        src={appearance.loginBackgroundUrl}
        alt="Campus"
        className="absolute inset-0 h-full w-full"
        style={{
          objectFit: activeBackground.fit,
          objectPosition: position,
          transform: scale,
          // Anchor zooming at the chosen focal point so position adjustments
          // remain effective after the image has been scaled.
          transformOrigin: position,
        }}
      />

      {/* Centered form */}
      <div className="relative z-10 w-full max-w-[540px] px-4 py-5">
        {children}
      </div>
    </div>
  );
}
