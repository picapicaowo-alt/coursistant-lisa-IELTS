import i18n, {type PostProcessorModule} from 'i18next';
import {initReactI18next} from 'react-i18next';
import {DEFAULT_LOCALE, isAppLocale, LOCALE_STORAGE_KEY, persistLocale, readLocale, SUPPORTED_LOCALES} from './configuration';
import {namespaces, resources} from './resources';

export {DEFAULT_LOCALE, isAppLocale, LANGUAGE_SWITCHER_ENABLED, LOCALE_LABELS, LOCALE_STORAGE_KEY, SUPPORTED_LOCALES} from './configuration';
export type {AppLocale} from './configuration';

const warned = new Set<string>();
const missingTranslationWarning: PostProcessorModule = {
  name: 'warnMissingTranslations',
  type: 'postProcessor',
  process(value, keys, options) {
    if (!import.meta.env.DEV) return value;
    const resolved = options.i18nResolved as {usedLng?: string; usedNS?: string; exactUsedKey?: string} | undefined;
    const locale = options.lng ?? i18n.language;
    const key = resolved?.exactUsedKey ?? keys[0];
    const namespace = resolved?.usedNS ?? 'common';
    // Also warn when English fallback masks a missing selected-locale translation.
    if (!i18n.getResource(locale, namespace, key)) {
      const id = `${locale}:${namespace}:${key}`;
      if (!warned.has(id)) {
        warned.add(id);
        console.warn(`[i18n] Missing translation: ${id}`);
      }
    }
    return value;
  },
};

function synchronizeLocale(locale: string): void {
  if (!isAppLocale(locale)) return;
  persistLocale(locale);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = locale;
    document.documentElement.dir = 'ltr';
  }
}

i18n.on('languageChanged', synchronizeLocale);
void i18n.use(initReactI18next).use(missingTranslationWarning).init({
  resources,
  lng: readLocale(),
  supportedLngs: [...SUPPORTED_LOCALES],
  fallbackLng: DEFAULT_LOCALE,
  load: 'currentOnly',
  defaultNS: 'common',
  ns: namespaces,
  returnEmptyString: false,
  interpolation: {escapeValue: false},
  react: {useSuspense: false},
  postProcess: ['warnMissingTranslations'],
  postProcessPassResolved: true,
});

const onStorage = (event: StorageEvent) => {
  if (event.key === LOCALE_STORAGE_KEY && isAppLocale(event.newValue) && event.newValue !== i18n.language) {
    void i18n.changeLanguage(event.newValue);
  }
};
if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
if (import.meta.hot) import.meta.hot.dispose(() => {
  i18n.off('languageChanged', synchronizeLocale);
  window.removeEventListener('storage', onStorage);
});

export default i18n;
