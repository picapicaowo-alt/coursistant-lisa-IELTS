import type {CreateGroupSetPayload} from '@/apis/types/course';
import {parseInputDateTime} from '@/i18n/dateInput';

/** Keep optional numeric/date fields distinct from partially entered invalid input. */
export function validGroupCapacity(value: number | null | undefined, form: HTMLFormElement, name: string): boolean {
  const input = form.elements.namedItem(name);
  return !(input instanceof HTMLInputElement && input.validity.badInput)
    && (value == null || (Number.isInteger(value) && value > 0));
}

export function groupSetValidationKey(draft: Partial<CreateGroupSetPayload>, form: HTMLFormElement): string | null {
  if (!draft.name?.trim()) return 'courseTools:groups.requiredName';
  if (!validGroupCapacity(draft.defaultCapacity, form, 'defaultCapacity')) return 'courseTools:groups.invalidCapacity';
  const fields = new FormData(form);
  for (const name of ['joinOpensAt', 'joinClosesAt']) {
    const raw = String(fields.get(name) ?? '').trim();
    if (raw && !parseInputDateTime(raw)) return 'courseTools:groups.invalidDateTime';
  }
  if (draft.joinOpensAt && draft.joinClosesAt && draft.joinClosesAt <= draft.joinOpensAt) return 'courseTools:groups.invalidWindow';
  return null;
}
