/**
 * UI language store
 * Persists preferred display language (en, ta, si) for translation.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UiLanguage = 'en' | 'ta' | 'si';

interface LanguageState {
  uiLanguage: UiLanguage;
  setUiLanguage: (lang: UiLanguage) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      uiLanguage: 'en',
      setUiLanguage: (lang) => set({ uiLanguage: lang }),
    }),
    { name: 'lecstu-ui-language' }
  )
);
