import type {StudentType} from '@/apis';

export interface StudentIntakeFormValue {
  firstName: string;
  middleName: string;
  lastName: string;
  email: string;
  studentType: StudentType;
  courseRequest: string;
  contactPhone: string;
  basicBackground: string;
}

export const emptyStudentIntakeForm: StudentIntakeFormValue = {
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  studentType: 'STANDARD',
  courseRequest: '',
  contactPhone: '',
  basicBackground: '',
};

/** Use the shared fields' existing HTML constraints, but return a semantic key
 * instead of browser-language validation bubbles. Disabled edit fields are not
 * validated, and whitespace cannot satisfy required text fields. */
export function studentIntakeValidationKey(form: HTMLFormElement): string | undefined {
  for (const field of Array.from(form.elements)) {
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) || field.matches(':disabled')) continue;
    const value = field.value.trim();
    if (field instanceof HTMLInputElement && field.type === 'email' && (!value || field.validity.typeMismatch)) return 'advising:intake.validation.email';
    if (field.required && !value) return 'advising:intake.validation.required';
    if (field.name === 'contactPhone' && value && (value.length < field.minLength || value.length > field.maxLength)) return 'advising:intake.validation.phone';
    if (field.maxLength >= 0 && value.length > field.maxLength) return 'advising:intake.validation.length';
  }
  return undefined;
}
