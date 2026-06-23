import { type CSSProperties, createElement } from 'react'
import { fieldTitle, fieldType } from '@/lib/meta'

export const chartColors = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
  'var(--chart-4)', 'var(--chart-5)',
] as const

export const tooltipProps: Record<string, CSSProperties> = {
  contentStyle: {
    background: 'var(--background)',
    border: '0 none',
    borderRadius: 4,
    color: 'var(--foreground)',
    fontSize: 10,
    paddingLeft: 12,
    paddingTop: 4,
    paddingRight: 8,
    paddingBottom: 4,
  },
  cursor: { fill: 'var(--muted)', stroke: 'var(--border)' },
  itemStyle: { paddingTop: 0, paddingBottom: 0 },
  labelStyle: { fontSize: 10, paddingBottom: 2 }
}

export const legendFormatter = (value: string) =>
  createElement('span', { style: { color: 'var(--foreground)', fontSize: 10 } }, fieldTitle(value))

function detectFieldType(fieldName: string): string | undefined {
  return fieldType(fieldName) === 'time' ? 'time' : fieldType(fieldName) === 'number' || fieldType(fieldName) === 'integer' || fieldType(fieldName) === 'float' ? 'number' : 'string'
}

function formatDateValue(value: string, fmt: string): string {
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  const o: Intl.DateTimeFormatOptions = { timeZone: 'UTC' }
  switch (fmt) {
    case 'date-M/D': o.month = 'numeric'; o.day = 'numeric'; break
    case 'date-M/D/YYYY': o.month = 'numeric'; o.day = 'numeric'; o.year = 'numeric'; break
    case 'date-MMM-D': o.month = 'short'; o.day = 'numeric'; break
    case 'date-MMM-D-YYYY': o.month = 'short'; o.day = 'numeric'; o.year = 'numeric'; break
    case 'date-YYYY-MM-DD': return value.slice(0, 10)
    default: {
      const isCurrentYear = d.getUTCFullYear() === new Date().getFullYear()
      if (isCurrentYear) { o.month = 'short'; o.day = 'numeric' }
      else { o.month = 'short'; o.day = 'numeric'; o.year = 'numeric' }
    }
  }
  return new Intl.DateTimeFormat('en-US', o).format(d)
}

function formatNum(n: number, fmt?: string, p?: number): string {
  if (fmt === 'comma' || !fmt) {
    return n.toLocaleString('en-US', {
      minimumFractionDigits: p ?? 0,
      maximumFractionDigits: p ?? 0,
    })
  }
  if (fmt === 'compact') {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(p ?? 0) + 'M'
    if (n >= 1_000) return (n / 1_000).toFixed(p ?? 0) + 'K'
    return n.toLocaleString('en-US', {
      minimumFractionDigits: p ?? 0,
      maximumFractionDigits: p ?? 0,
    })
  }
  // none
  if (p && p > 0) return n.toFixed(p)
  return String(Math.round(n))
}

export function formatValue(value: unknown, fmt?: string, ft?: string, prefix?: string, precision?: number): string {
  if (fmt === 'string' || fmt === 'auto') fmt = undefined

  const n = typeof value === 'number' ? value : Number(value)
  const validNum = !isNaN(n)

  // Date formats
  if (fmt?.startsWith('date-')) {
    return formatDateValue(String(value ?? ''), fmt)
  }

  // New simple format names
  if (validNum) {
    const formatted = formatNum(n, fmt, precision)
    if (prefix) return prefix + formatted
    return formatted
  }

  // Backward compat: old format names (standalone widgets)
  if (fmt?.startsWith('currency-') && validNum) {
    const code = fmt.slice(9)
    const currencySymbols: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', JPY: '¥' }
    const sym = currencySymbols[code] || code
    if (code === 'JPY') return sym + Math.round(n).toLocaleString('en-US')
    return sym + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  if (fmt?.startsWith('number-') && validNum) {
    switch (fmt) {
      case 'number-compact': {
        if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
        if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
        return n.toLocaleString('en-US')
      }
      case 'number-comma-1': return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      case 'number-comma-2': return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      case 'number-comma-3': return n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })
      default: return n.toLocaleString('en-US')
    }
  }

  // Auto-detect from field type
  if (ft === 'time' && !fmt) {
    return formatDateValue(String(value ?? ''), 'auto')
  }
  if (ft === 'number' && !fmt && validNum) {
    const formatted = n.toLocaleString('en-US')
    if (prefix) return prefix + formatted
    return formatted
  }

  return String(value ?? '')
}

export { detectFieldType }
export const axisTickStyle = { fontSize: 10, fill: 'var(--muted-foreground)' }
