import i18n from './index';

/** Keep validation identity through async mutations so messages can change locale. */
export class LocalizedError extends Error {
  constructor(readonly translationKey: string, readonly parameters?: Record<string, string | number>) {
    super(i18n.t(translationKey, parameters));
    this.name = 'LocalizedError';
  }

  localizedMessage(): string {
    return i18n.t(this.translationKey, this.parameters);
  }
}
