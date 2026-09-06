import {useTranslation} from 'react-i18next';
import {isAppLocale, LOCALE_LABELS, SUPPORTED_LOCALES} from '@/i18n/configuration';
import styles from './LanguageSwitcher.module.scss';

export default function LanguageSwitcher() {
  const {t, i18n} = useTranslation('common');
  return (
    <select
      className={styles.select}
      aria-label={t('language.label')}
      value={i18n.language}
      onChange={event => {
        if (isAppLocale(event.target.value)) void i18n.changeLanguage(event.target.value);
      }}
    >
      {SUPPORTED_LOCALES.map(locale => <option key={locale} value={locale}>{LOCALE_LABELS[locale]}</option>)}
    </select>
  );
}
