"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { I18nProvider } from "react-aria";
import {
  DEFAULT_LOCALE,
  getStoredLocale,
  setStoredLocale,
  subscribeToLocale,
  translate,
  type Locale,
} from "./locale";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribeToLocale, getStoredLocale, () => DEFAULT_LOCALE);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale: setStoredLocale,
      t: (key: string) => translate(key, locale),
    }),
    [locale],
  );

  return (
    <LocaleContext.Provider value={value}>
      <I18nProvider locale={locale}>{children}</I18nProvider>
    </LocaleContext.Provider>
  );
}

// Components may be rendered in isolation (for example in unit tests or story previews).
// They still get the product default without requiring every isolated render to recreate app providers;
// one value, like the provider's, so `t` can be a dependency without changing on every render.
const DEFAULT_VALUE: LocaleContextValue = {
  locale: DEFAULT_LOCALE,
  setLocale: setStoredLocale,
  t: (key: string) => translate(key, DEFAULT_LOCALE),
};

export function useLocale(): LocaleContextValue {
  return useContext(LocaleContext) ?? DEFAULT_VALUE;
}
