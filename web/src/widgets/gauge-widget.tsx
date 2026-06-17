interface GaugeConfig {
  valueField?: string
  min?: number
  max?: number
  thresholds?: { from: number; to: number; color: string }[]
  format?: string
}

interface GaugeWidgetProps {
  data: Record<string, unknown>[]
  config: GaugeConfig
}

export function GaugeWidget({ data, config }: GaugeWidgetProps) {
  if (!data.length) return null
  const value = data[0][config.valueField ?? ''] as number | undefined ?? 0
  const min = config.min ?? 0
  const max = config.max ?? 100
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))

  let color = 'var(--primary)'
  if (config.thresholds) {
    const match = config.thresholds.find((t) => value >= t.from && value <= t.to)
    if (match) color = match.color
  }

  const formatted = config.format === 'percent' ? `${Math.round(pct)}%` : String(value)

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
        <circle
          cx="60" cy="60" r="50"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={`${(pct / 100) * 314} 314`}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
        />
        <text x="60" y="60" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-lg font-bold">
          {formatted}
        </text>
      </svg>
    </div>
  )
}
