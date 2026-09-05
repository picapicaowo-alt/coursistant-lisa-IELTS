import {readFileSync, readdirSync} from 'node:fs';
import {createInstance, type Resource, type TOptions} from 'i18next';

export const productLocales = ['en', 'zh-CN', 'zh-TW'] as const;
const resources: Resource = Object.fromEntries(productLocales.map(locale => [locale, Object.fromEntries(
  readdirSync(new URL(`../src/i18n/resources/${locale}/`, import.meta.url))
    .filter(file => file.endsWith('.json'))
    .map(file => [file.slice(0, -5), JSON.parse(readFileSync(new URL(`../src/i18n/resources/${locale}/${file}`, import.meta.url), 'utf8'))]),
)]));
const engine = createInstance();
// Bundled resources initialize synchronously; tests never fetch translations.
void engine.init({resources, lng: 'en', fallbackLng: 'en', initImmediate: false, interpolation: {escapeValue: false}});
export const tx = (locale: string, key: string, options: TOptions = {}) => engine.getFixedT(locale)(key, options);

/** English product controls that should not remain in a Chinese interface.
 * Authored records and original exam content are outside this assertion. */
export function untranslatedControlCopy(locale: string): Set<string> {
  const result = new Set<string>();
  function visit(value: unknown, key: string) {
    if (typeof value === 'string') {
      if (value.length >= 4 && /^[A-Za-z]/.test(value) && !value.includes('{{') && tx(locale, key) !== value) result.add(value);
    } else if (value && typeof value === 'object') for (const [name, child] of Object.entries(value)) visit(child, key + '.' + name);
  }
  for (const [namespace, resource] of Object.entries(resources.en)) {
    for (const [name, value] of Object.entries(resource)) visit(value, namespace + ':' + name);
  }
  return result;
}
