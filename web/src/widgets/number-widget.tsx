interface NumberWidgetProps {
  data: Record<string, unknown>[]
  config: {
    valueField?: string
    trendField?: string
    trendLabel?: string
    prefix?: string
    suffix?: string
    decimals?: number
    color?: string
  }
}

export function NumberWidget({ data, config }: NumberWidgetProps) {
  if (!data.length) return null
  const value = data[0][config.valueField ?? ''] as number | undefined
  const trend = config.trendField ? (data[0][config.trendField] as number | undefined) : undefined
  const formatted = value?.toFixed(config.decimals ?? 0) ?? '—'

  return (
    <div className="flex h-full flex-col items-center justify-center gap-1">
      <span className="text-3xl font-bold" style={{ color: config.color }}>
        {config.prefix}{formatted}{config.suffix}
      </span>
      {trend !== undefined && (
        <span className={`text-sm ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {config.trendLabel ? `${config.trendLabel}: ` : ''}{trend >= 0 ? '+' : ''}{trend}
        </span>
      )}
    </div>
  )
}
