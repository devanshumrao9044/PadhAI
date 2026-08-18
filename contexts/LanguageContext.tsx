import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getItem, setItem, StorageKeys } from '@/services/storage';
import { Language, translate, TranslationKey, TranslationParams } from '@/constants/translations';

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
  t: (key: TranslationKey, params?: TranslationParams) => string;
  ready: boolean;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    getItem<Language>(StorageKeys.LANGUAGE).then(saved => {
      if (!mounted) return;
      if (saved === 'en' || saved === 'hi') setLanguageState(saved);
      setReady(true);
    }).catch(() => {
      if (mounted) setReady(true);
    });
    return () => { mounted = false; };
  }, []);

  const setLanguage = useCallback(async (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    await setItem(StorageKeys.LANGUAGE, nextLanguage);
  }, []);

  const t = useCallback((key: TranslationKey, params?: TranslationParams) => (
    translate(language, key, params)
  ), [language]);

  const value = useMemo(() => ({ language, setLanguage, t, ready }), [language, setLanguage, t, ready]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider.');
  return context;
}
