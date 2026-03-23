"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { vi, Translations } from '../i18n/vi';
import { en } from '../i18n/en';

type LanguageCode = 'vi' | 'en';

type LanguageContextType = {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: keyof Translations, params?: Record<string, string | number>) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const dictionaries: Record<LanguageCode, Translations> = {
  vi,
  en,
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>('vi'); // Vietnamese is the default
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const savedLang = localStorage.getItem('kululu_language') as LanguageCode;
    if (savedLang && ['vi', 'en'].includes(savedLang)) {
      setLanguageState(savedLang);
    }
  }, []);

  const setLanguage = useCallback((lang: LanguageCode) => {
    setLanguageState(lang);
    localStorage.setItem('kululu_language', lang);
  }, []);

  const t = useCallback((key: keyof Translations, params?: Record<string, string | number>): string => {
    // If we're not mounted yet, it's safer to always return the default dict string 
    // to prevent React hydration mismatches on the client vs server.
    const dict = isMounted ? dictionaries[language] : dictionaries['vi'];
    let text = dict[key] || vi[key] || key;
    
    // Simple variable interpolation like {name}
    if (params) {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        text = text.replace(new RegExp(`{${paramKey}}`, 'g'), String(paramValue));
      });
    }
    
    return text;
  }, [language, isMounted]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
