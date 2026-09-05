import '@testing-library/jest-dom';
import {render} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import i18n, {LANGUAGE_SWITCHER_ENABLED, SUPPORTED_LOCALES} from '../i18n';
import LanguageSwitcher from './LanguageSwitcher';

describe('staged locale rollout', () => {
  it('keeps the incomplete language picker hidden and starts in English', () => {
    const {container} = render(<LanguageSwitcher/>);

    expect(LANGUAGE_SWITCHER_ENABLED).toBe(false);
    expect(SUPPORTED_LOCALES).toEqual(['en', 'zh-CN', 'zh-TW']);
    expect(i18n.resolvedLanguage).toBe('en');
    expect(container).toBeEmptyDOMElement();
  });
});
