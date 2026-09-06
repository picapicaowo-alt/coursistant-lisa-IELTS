/** Open enclosing disclosures without remounting their unsaved form fields. */
export function revealDisclosureAncestors(target: Element): void {
  let current: Element | null = target;
  while (current) {
    if (current instanceof HTMLDetailsElement) current.open = true;
    current = current.parentElement;
  }
}

/** Keep native focus behavior when localized inline validation replaces bubbles. */
export function focusFirstInvalidField(form: HTMLFormElement): boolean {
  for (const field of Array.from(form.elements)) {
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) || !field.willValidate) continue;
    const value = field.value.trim();
    const invalidLength = !(field instanceof HTMLSelectElement) && value.length > 0 &&
      ((field.minLength > 0 && value.length < field.minLength) || (field.maxLength >= 0 && value.length > field.maxLength));
    if (!field.validity.valid || (field.required && !value) || invalidLength) {
      revealDisclosureAncestors(field);
      field.focus();
      return true;
    }
  }
  return false;
}
