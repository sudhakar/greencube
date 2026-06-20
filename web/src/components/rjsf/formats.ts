export const FORMAT_OPTIONS: Record<string, { value: string; label: string }[]> = {
  number: [
    { value: 'none', label: 'raw' },
    { value: 'comma', label: 'comma' },
    { value: 'compact', label: 'short' },
  ],
  time: [
    { value: 'date-M/D', label: '4/25' },
    { value: 'date-M/D/YYYY', label: '4/25/2026' },
    { value: 'date-MMM-D', label: 'Apr 25' },
    { value: 'date-MMM-D-YYYY', label: 'Apr 25, 2026' },
    { value: 'date-YYYY-MM-DD', label: '2026-04-25' },
  ],
  string: [
    { value: 'none', label: 'Raw' },
  ],
  all: [
    { value: 'none', label: 'raw' },
    { value: 'comma', label: 'comma' },
    { value: 'compact', label: 'short' },
    { value: 'date-M/D', label: '4/25' },
    { value: 'date-M/D/YYYY', label: '4/25/2026' },
    { value: 'date-MMM-D', label: 'Apr 25' },
    { value: 'date-MMM-D-YYYY', label: 'Apr 25, 2026' },
    { value: 'date-YYYY-MM-DD', label: '2026-04-25' },
  ],
}

export function shortField(f: string) {
  const d = f.indexOf('.')
  return d >= 0 ? f.slice(d + 1) : f
}

export const PREFIX_OPTIONS = [
  { value: '', label: '—' },
  { value: '$', label: '$' },
  { value: '€', label: '€' },
  { value: '£', label: '£' },
  { value: '¥', label: '¥' },
]

export const FIELD_PREFIX_OPTIONS = [
  { value: '', label: '—' },
  { value: '$', label: '$' },
  { value: '€', label: '€' },
  { value: '£', label: '£' },
  { value: '¥', label: '¥' },
]
