import type {i18n} from 'i18next';

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
const isControl = (value: EventTarget | null): value is Control => value instanceof HTMLInputElement || value instanceof HTMLSelectElement || value instanceof HTMLTextAreaElement;

/** Localize native browser feedback without changing constraints or field values.
 * Specialized date/person controls retain ownership of their custom validity.
 */
export function installNativeValidationLocalization(engine: i18n, root: Document) {
  const owned = new WeakMap<Control, string>();
  const clearOwned = (field: Control) => {
    if (owned.get(field) === field.validationMessage) field.setCustomValidity('');
    owned.delete(field);
  };
  const localize = (field: Control) => {
    clearOwned(field);
    const state = field.validity;
    if (state.valid || state.customError) return;
    let message: string;
    const number = (value: number) => new Intl.NumberFormat(engine.resolvedLanguage ?? engine.language).format(value);
    if (state.valueMissing) message = engine.t('common:validation.requiredField');
    else if (state.typeMismatch && field instanceof HTMLInputElement && field.type === 'email') message = engine.t('auth:signupErrors.emailInvalid');
    else if (state.typeMismatch && field instanceof HTMLInputElement && field.type === 'url') message = engine.t('common:validation.url');
    else if (state.badInput) message = engine.t('common:validation.number');
    else if (state.rangeUnderflow && field instanceof HTMLInputElement && field.type === 'number') message = engine.t('common:validation.minimum', {value: number(Number(field.min))});
    else if (state.rangeOverflow && field instanceof HTMLInputElement && field.type === 'number') message = engine.t('common:validation.maximum', {value: number(Number(field.max))});
    else if (state.tooShort && !(field instanceof HTMLSelectElement)) message = engine.t('common:validation.minimumLength', {value: number(field.minLength)});
    else if (state.tooLong && !(field instanceof HTMLSelectElement)) message = engine.t('common:validation.maximumLength', {value: number(field.maxLength)});
    else if (state.stepMismatch) message = engine.t('common:validation.step');
    else message = engine.t('common:validation.format');
    field.setCustomValidity(message);
    owned.set(field, message);
  };
  const onInvalid = (event: Event) => {if (isControl(event.target)) localize(event.target);};
  const onInput = (event: Event) => {if (isControl(event.target)) clearOwned(event.target);};
  const onReset = (event: Event) => {
    if (event.target instanceof HTMLFormElement) Array.from(event.target.elements).forEach(field => {if (isControl(field)) clearOwned(field);});
  };
  const onLanguage = () => {
    root.querySelectorAll('input, select, textarea').forEach(field => {
      if (isControl(field) && owned.has(field)) localize(field);
    });
  };
  root.addEventListener('invalid', onInvalid, true);
  root.addEventListener('input', onInput, true);
  root.addEventListener('change', onInput, true);
  root.addEventListener('reset', onReset, true);
  engine.on('languageChanged', onLanguage);
  return () => {
    root.removeEventListener('invalid', onInvalid, true);
    root.removeEventListener('input', onInput, true);
    root.removeEventListener('change', onInput, true);
    root.removeEventListener('reset', onReset, true);
    engine.off('languageChanged', onLanguage);
    root.querySelectorAll('input, select, textarea').forEach(field => {if (isControl(field)) clearOwned(field);});
  };
}
