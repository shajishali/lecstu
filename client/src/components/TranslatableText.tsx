/**
 * TranslatableText
 * Renders text, translating when UI language is Tamil or Sinhala.
 */
import { useState, useEffect } from 'react';
import { useLanguageStore } from '@store/languageStore';
import { useTranslation } from '@hooks/useTranslation';
import { decodeHtmlEntities } from '@utils/html';

interface TranslatableTextProps {
  text: string;
  sourceLang?: 'en' | 'ta' | 'si';
  as?: keyof JSX.IntrinsicElements;
  className?: string;
}

export default function TranslatableText({ text, sourceLang = 'en', as: Tag = 'span', className }: TranslatableTextProps) {
  const uiLanguage = useLanguageStore((s) => s.uiLanguage);
  const { translate } = useTranslation();
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    if (!text?.trim() || uiLanguage === 'en' || uiLanguage === sourceLang) {
      setDisplay(text);
      return;
    }
    let cancelled = false;
    translate(text, uiLanguage, sourceLang).then((t) => {
      if (!cancelled) setDisplay(t);
    });
    return () => { cancelled = true; };
  }, [text, uiLanguage, sourceLang, translate]);

  return <Tag className={className}>{decodeHtmlEntities(display)}</Tag>;
}
