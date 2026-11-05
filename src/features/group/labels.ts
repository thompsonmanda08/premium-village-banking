export const POSITIONS = [
  { value: 'chairperson', label: 'Chairperson' },
  { value: 'vice_chair', label: 'Vice-chair' },
  { value: 'treasurer', label: 'Treasurer' },
  { value: 'vice_treasurer', label: 'Vice-treasurer' },
  { value: 'secretary', label: 'Secretary' },
  { value: 'trustee', label: 'Trustee' },
] as const;

export const PURPOSES = [
  { value: 'business', label: 'Business' },
  { value: 'education', label: 'Education' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'other', label: 'Other' },
] as const;

/** A stored value as a word; a value this app does not know yet shows as itself rather than hiding. */
const labelOf = (list: ReadonlyArray<{ value: string; label: string }>, v: string | null | undefined): string => (v ? (list.find((x) => x.value === v)?.label ?? v) : '');
export const positionLabel = (v: string | null | undefined): string => labelOf(POSITIONS, v);
export const purposeLabel = (v: string | null | undefined): string => (v === 'unspecified' ? 'Not stated' : labelOf(PURPOSES, v));
