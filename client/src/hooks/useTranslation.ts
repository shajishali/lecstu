/**
 * Translation hook
 * Translates text via /api/ai/translation/translate when target language is not English.
 * Fails fast so slow/unavailable translation never blocks other API calls.
 */
import { useState, useCallback } from 'react';
import api from '@services/api';
import type { UiLanguage } from '@store/languageStore';

const cache = new Map<string, string>();
const failedKeys = new Set<string>();
const inflight = new Map<string, Promise<string>>();

/** Lightweight engines only — mBART is too slow/heavy for routine UI translation. */
const ENGINES: Array<'google' | 'marian'> = ['google', 'marian'];
const ENGINE_TIMEOUT_MS = 8000;

export function useTranslation() {
  const [isTranslating, setIsTranslating] = useState(false);

  const translate = useCallback(
    async (text: string, targetLang: UiLanguage, sourceLang: UiLanguage = 'en'): Promise<string> => {
      if (!text?.trim() || targetLang === sourceLang) return text;

      const key = `${sourceLang}:${targetLang}:${text}`;
      if (cache.has(key)) return cache.get(key)!;
      if (failedKeys.has(key)) return text;
      if (inflight.has(key)) return inflight.get(key)!;

      const request = (async () => {
        setIsTranslating(true);
        try {
          for (const engine of ENGINES) {
            try {
              const { data } = await api.post<{
                success: boolean;
                data?: { translated_text?: string };
              }>(
                '/ai/translation/translate',
                { text, src: sourceLang, tgt: targetLang, engine },
                { timeout: ENGINE_TIMEOUT_MS },
              );

              const translated = data.data?.translated_text?.trim();
              if (data.success && translated) {
                cache.set(key, translated);
                return translated;
              }
            } catch {
              /* try next engine */
            }
          }

          failedKeys.add(key);
          return text;
        } finally {
          setIsTranslating(false);
          inflight.delete(key);
        }
      })();

      inflight.set(key, request);
      return request;
    },
    [],
  );

  return { translate, isTranslating };
}
