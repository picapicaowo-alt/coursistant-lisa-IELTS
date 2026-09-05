export const SUPPORTED_LOCALES = ['en', 'zh-CN', 'zh-TW'] as const;
export type AppLocale = typeof SUPPORTED_LOCALES[number];
export const DEFAULT_LOCALE: AppLocale = 'en';
export const LOCALE_STORAGE_KEY = 'coursistant.locale';

// Expose the shared selector only after route-level single-locale acceptance.
export const LANGUAGE_SWITCHER_ENABLED = false;

/** Autonyms are intentionally stable so a user can recover from a wrong selection. */
export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
};

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && SUPPORTED_LOCALES.some(locale => locale === value);
}

export function readLocale(): AppLocale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isAppLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    // Private browsing/storage policies must not prevent the application loading.
    return DEFAULT_LOCALE;
  }
}

export function persistLocale(locale: AppLocale): void {
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // The in-memory language still works when browser persistence is unavailable.
  }
}
