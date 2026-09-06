import {afterEach, describe, expect, it, vi} from 'vitest';
import i18n from './index';
import {DEFAULT_LOCALE, LOCALE_STORAGE_KEY, readLocale, SUPPORTED_LOCALES} from './configuration';
import {formatDateTime, formatNumber, formatPercent} from './formatting';
import {resources} from './resources';

function leaves(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value === 'string') return {[prefix]: value};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid resource at ${prefix}`);
  return Object.fromEntries(Object.entries(value).flatMap(([key, child]) => Object.entries(leaves(child, prefix ? `${prefix}.${key}` : key))));
}

const parameters = (value: string) => [...value.matchAll(/\{\{\s*([^},]+)(?:,[^}]+)?\s*\}\}/g)].map(match => match[1].trim()).sort();

afterEach(async () => {
  vi.restoreAllMocks();
  await i18n.changeLanguage('en');
  localStorage.clear();
});

describe('locale resources', () => {
  const english = leaves(resources.en);
  for (const locale of SUPPORTED_LOCALES) {
    it(`${locale} has complete, nonempty keys and matching interpolation parameters`, () => {
      const translated = leaves(resources[locale]);
      expect(Object.keys(translated).sort()).toEqual(Object.keys(english).sort());
      for (const [key, value] of Object.entries(english)) {
        expect(translated[key].trim(), key).not.toBe('');
        expect(parameters(translated[key]), key).toEqual(parameters(value));
      }
    });
  }

  it('does not use English copies to fill Chinese resources', () => {
    for (const locale of ['zh-CN', 'zh-TW']) {
      const translated = leaves(resources[locale]);
      for (const [key, value] of Object.entries(english)) {
        if (/[a-z]/i.test(value.replace(/\{\{[^}]*\}\}/g, ''))) expect(translated[key], `${locale}:${key}`).not.toBe(value);
      }
    }
  });

  it('retains reviewed Taiwan product terminology instead of ambiguous conversion output', () => {
    for (const [key, value] of Object.entries(leaves(resources['zh-TW']))) {
      expect(value, key).not.toMatch(/學習計劃|學生髮送|反饋|許可權|稽覈|考試型別|釋出|行動資料|周次|電子電子郵件|身份|諮詢師/);
    }
    expect(leaves(resources['zh-CN'])['advising.actionTasks.intake']).toBe('入学档案');
    expect(leaves(resources['zh-TW'])['advising.actionTasks.intake']).toBe('入學檔案');
  });
});

describe('locale persistence and fallback', () => {
  it('reads the persisted locale on startup and rejects unsupported or corrupt values', () => {
    expect(readLocale()).toBe(DEFAULT_LOCALE);
    for (const locale of SUPPORTED_LOCALES) {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
      expect(readLocale()).toBe(locale);
    }
    localStorage.setItem(LOCALE_STORAGE_KEY, 'zh-XX');
    expect(readLocale()).toBe(DEFAULT_LOCALE);
  });

  it('continues to translate when storage is blocked', async () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {throw new Error('Storage denied');});
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {throw new Error('Storage denied');});
    expect(readLocale()).toBe(DEFAULT_LOCALE);
    await expect(i18n.changeLanguage('zh-TW')).resolves.toBeDefined();
    expect(i18n.t('menu.settings')).toBe('設定');
  });

  it('synchronizes another tab without accepting unrelated storage events', () => {
    window.dispatchEvent(new StorageEvent('storage', {key: LOCALE_STORAGE_KEY, newValue: 'zh-TW'}));
    expect(i18n.language).toBe('zh-TW');
    expect(document.documentElement.lang).toBe('zh-TW');
    window.dispatchEvent(new StorageEvent('storage', {key: 'unrelated', newValue: 'en'}));
    expect(i18n.language).toBe('zh-TW');
  });

  it('falls back to English and warns in development instead of concealing a missing locale key', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    i18n.addResource('en', 'testOnly', 'fallback', 'English fallback');
    await i18n.changeLanguage('zh-CN');
    expect(i18n.t('testOnly:fallback')).toBe('English fallback');
    expect(warning).toHaveBeenCalledWith('[i18n] Missing translation: zh-CN:testOnly:fallback');
    i18n.removeResourceBundle('en', 'testOnly');
  });
});

describe('locale-aware formatting', () => {
  for (const locale of SUPPORTED_LOCALES) {
    it(`formats dates, numbers and percentages in ${locale}`, async () => {
      await i18n.changeLanguage(locale);
      const instant = new Date('2026-09-04T15:20:00Z');
      const options: Intl.DateTimeFormatOptions = {year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'};
      expect(formatDateTime(instant, options)).toBe(new Intl.DateTimeFormat(locale, options).format(instant));
      expect(formatNumber(12345.6)).toBe(new Intl.NumberFormat(locale).format(12345.6));
      expect(formatPercent(0.25)).toBe(new Intl.NumberFormat(locale, {style: 'percent'}).format(0.25));
      // Count stays numeric for plural selection; only the displayed value is formatted.
      expect(i18n.t('common:admin.resultCount', {count: 12345})).toContain(new Intl.NumberFormat(locale).format(12345));
      expect(instant.toISOString()).toBe('2026-09-04T15:20:00.000Z');
    });
  }
});
