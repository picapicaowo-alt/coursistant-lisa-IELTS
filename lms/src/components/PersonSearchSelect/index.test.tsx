import {useState} from 'react';
import {createInstance} from 'i18next';
import {I18nextProvider, useTranslation} from 'react-i18next';
import {act, fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import en from '@/i18n/resources/en/common.json';
import simplified from '@/i18n/resources/zh-CN/common.json';
import traditional from '@/i18n/resources/zh-TW/common.json';
import {PersonSearchSelect, type PersonSearchOption} from './index';

const resources = {en: {common: en}, 'zh-CN': {common: simplified}, 'zh-TW': {common: traditional}};

function Picker() {
  const {t} = useTranslation('common');
  const [search, onSearch] = useState('');
  const [selected, onSelect] = useState<PersonSearchOption>();
  return <PersonSearchSelect label={t('people.instructor')} search={search} onSearch={onSearch}
    selected={selected} onSelect={onSelect} options={search === 'missing' ? [] : [{value: '17', label: 'Ari Chen', person: {id: 17, firstName: 'Ari', lastName: 'Chen'}}]} required/>;
}

describe('shared people localization', () => {
  it('updates input, validation, selected identity and empty state live in every supported translation', async () => {
    const i18n = createInstance();
    await i18n.init({resources, lng: 'en', fallbackLng: 'en', defaultNS: 'common', interpolation: {escapeValue: false}});
    render(<I18nextProvider i18n={i18n}><Picker/></I18nextProvider>);
    for (const locale of ['en', 'zh-CN', 'zh-TW'] as const) {
      await act(async () => {await i18n.changeLanguage(locale);});
      const copy = resources[locale].common.people;
      const input = screen.getByRole('combobox', {name: copy.instructor});
      expect(input).toHaveAttribute('placeholder', copy.searchPlaceholder);
      fireEvent.change(input, {target: {value: 'missing'}});
      expect(screen.getByRole('status')).toHaveTextContent(copy.noMatches);
      expect(input).toBeInvalid();
      expect((input as HTMLInputElement).validationMessage).toBe(i18n.t('people.selectRequired', {label: copy.instructor.toLowerCase()}));
      fireEvent.click(screen.getByRole('button', {name: i18n.t('people.clear', {label: copy.instructor.toLowerCase()})}));
      fireEvent.click(screen.getByRole('option', {name: 'Ari Chen'}));
      expect(input).toHaveValue('Ari Chen');
      expect(input).toBeValid();
      expect(input).toHaveAttribute('aria-expanded', 'false');
    }
  });

  it('keeps all new shared semantic keys and interpolation parameters in parity', () => {
    for (const section of ['people', 'intake', 'accessibility'] as const) {
      for (const translated of [simplified[section], traditional[section]]) {
        expect(Object.keys(translated).sort()).toEqual(Object.keys(en[section]).sort());
        for (const [key, value] of Object.entries(en[section])) {
          const translatedValue = translated[key as keyof typeof translated] as string;
          expect(translatedValue.match(/{{\w+}}/g) ?? []).toEqual(value.match(/{{\w+}}/g) ?? []);
        }
      }
    }
  });
});
