export const chartColors = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)',
  'var(--chart-4)', 'var(--chart-5)',
] as const

export const tooltipStyle: React.CSSProperties = {
  background: 'var(--background)',
  border: '0 none',
  borderRadius: 4,
  color: 'var(--foreground)',
  fontSize: 10,
  paddingLeft: 12,
  paddingTop: 4,
  paddingRight: 8,
  paddingBottom: 0,

}

export const tooltipCursor = { fill: 'var(--muted)', stroke: 'var(--border)' }

export const axisTickStyle = { fontSize: 10, fill: 'var(--muted-foreground)' }
