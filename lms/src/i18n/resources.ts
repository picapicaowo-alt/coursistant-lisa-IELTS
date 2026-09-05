import type {Resource} from 'i18next';
import {SUPPORTED_LOCALES} from './configuration';

// Resources are bundled, never fetched at runtime or stored in separate role engines.
const files = import.meta.glob('./resources/*/*.json', {eager: true, import: 'default'});
export const resources: Resource = Object.fromEntries(SUPPORTED_LOCALES.map(locale => [locale, {}]));

for (const [path, resource] of Object.entries(files)) {
  const [, locale, namespace] = path.match(/\/resources\/([^/]+)\/([^/]+)\.json$/) ?? [];
  if (locale in resources && namespace) {
    resources[locale][namespace] = resource as Record<string, unknown>;
  }
}

export const namespaces = Object.keys(resources.en);
