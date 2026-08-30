/**
 * Assign sorted multi-select letters into consecutive questionId slots.
 * Empty slots become ''.
 */
export function assignMultiSelectSlots(
  questionIds: number[],
  selectedLetters: Iterable<string>,
): Record<number, string> {
  const ordered = [...selectedLetters].sort()
  const out: Record<number, string> = {}
  questionIds.forEach((id, index) => {
    out[id] = ordered[index] ?? ''
  })
  return out
}
