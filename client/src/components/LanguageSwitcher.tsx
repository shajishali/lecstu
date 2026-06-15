/**
 * Language switcher
 * English / Tamil / Sinhala for UI translation.
 */
import { Globe } from 'lucide-react';
import { useLanguageStore, type UiLanguage } from '@store/languageStore';

const options: { value: UiLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ta', label: 'தமிழ்' },
  { value: 'si', label: 'සිංහල' },
];

interface LanguageSwitcherProps {
  /** When true, uses light colors for dark navbar */
  darkNav?: boolean;
}

export default function LanguageSwitcher({ darkNav }: LanguageSwitcherProps) {
  const uiLanguage = useLanguageStore((s) => s.uiLanguage);
  const setUiLanguage = useLanguageStore((s) => s.setUiLanguage);

  return (
    <div className="flex items-center gap-2">
      <Globe size={16} className={darkNav ? 'text-slate-300' : 'text-slate-500'} />
      <select
        value={uiLanguage}
        onChange={(e) => setUiLanguage(e.target.value as UiLanguage)}
        className={
          darkNav
            ? 'rounded border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white outline-none focus:border-white/40 focus:ring-1 focus:ring-white/20 [&>option]:bg-slate-800 [&>option]:text-white'
            : 'rounded border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)]'
        }
        aria-label="UI language"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
