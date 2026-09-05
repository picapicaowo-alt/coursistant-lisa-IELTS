import {afterEach, expect, it} from 'vitest';
import i18n, {SUPPORTED_LOCALES} from './index';
import {installNativeValidationLocalization} from './nativeValidation';

afterEach(async () => {await i18n.changeLanguage('en');});

it('localizes native constraints in every locale, preserves values and clears only its own errors', async () => {
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '1000';
  input.value = '2';
  document.body.append(input);
  const dispose = installNativeValidationLocalization(i18n, document);
  try {
    expect(input.checkValidity()).toBe(false);
    for (const locale of SUPPORTED_LOCALES) {
      await i18n.changeLanguage(locale);
      expect(input.validationMessage).toBe(i18n.t('common:validation.minimum', {value: new Intl.NumberFormat(locale).format(1000)}));
      expect(input.value).toBe('2');
      expect(input.min).toBe('1000');
    }
    input.value = '2000';
    input.dispatchEvent(new Event('input', {bubbles: true}));
    expect(input.checkValidity()).toBe(true);
    input.setCustomValidity('Component-owned message');
    expect(input.checkValidity()).toBe(false);
    input.dispatchEvent(new Event('input', {bubbles: true}));
    await i18n.changeLanguage('en');
    expect(input.validationMessage).toBe('Component-owned message');
  } finally {dispose(); input.remove();}
});

it('does not retain a custom error after localization is disposed', () => {
  const input = document.createElement('input');
  input.required = true;
  document.body.append(input);
  const dispose = installNativeValidationLocalization(i18n, document);
  expect(input.checkValidity()).toBe(false);
  expect(input.validationMessage).toBe(i18n.t('common:validation.requiredField'));
  dispose();
  expect(input.validity.customError).toBe(false);
  input.remove();
});
