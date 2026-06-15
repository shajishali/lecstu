/**
 * Translation hook
 * Translates text via /api/ai/translation/translate when target language is not English.
 */
import { useState, useCallback } from 'react';
import api from '@services/api';
import type { UiLanguage } from '@store/languageStore';

const cache = new Map<string, string>();

export function useTranslation() {
  const [isTranslating, setIsTranslating] = useState(false);

  const translate = useCallback(
    async (text: string, targetLang: UiLanguage, sourceLang: UiLanguage = 'en'): Promise<string> => {
      if (!text?.trim() || targetLang === sourceLang) return text;
      const key = `${sourceLang}:${targetLang}:${text}`;
      if (cache.has(key)) return cache.get(key)!;
      setIsTranslating(true);
      try {
        const engines: Array<'mbart' | 'google' | 'marian'> = ['mbart', 'google', 'marian'];
        const timeouts: Record<string, number> = { mbart: 125000, google: 95000, marian: 65000 };
        for (const engine of engines) {
          try {
            const { data } = await api.post<{ success: boolean; data?: { translated_text?: string }; message?: string }>(
              '/ai/translation/translate',
              { text, src: sourceLang, tgt: targetLang, engine },
              { timeout: timeouts[engine] }
            );
            const translated = data.data?.translated_text ?? text;
            cache.set(key, translated);
            return translated;
          } catch (err: unknown) {
            const axiosErr = err as { response?: { data?: { data?: { error?: string } } } };
            const msg = axiosErr?.response?.data?.data?.error || (err instanceof Error ? err.message : 'Unknown');
            const next = engines[engines.indexOf(engine) + 1];
            console.warn(`[Translation] ${engine} failed:`, msg, next ? `- trying ${next}...` : '');
          }
        }
        return text;
      } finally {
        setIsTranslating(false);
      }
    },
    []
  );

  return { translate, isTranslating };
}
