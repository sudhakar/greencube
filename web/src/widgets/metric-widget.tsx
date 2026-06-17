interface MetricField {
  label: string
  valueField: string
  prefix?: string
  suffix?: string
  color?: string
  formatter?: string
}

interface MetricConfig {
  fields: MetricField[]
}

interface MetricWidgetProps {
  data: Record<string, unknown>[]
  config: MetricConfig
}

export function MetricWidget({ data, config }: MetricWidgetProps) {
  if (!data.length || !config.fields?.length) return null

  return (
    <div className="flex h-full flex-col justify-center gap-3 p-2">
      {config.fields.map((f, i) => {
        const value = data[0][f.valueField] as number | undefined
        const formatted = value?.toFixed(2) ?? '—'
        return (
          <div key={i} className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{f.label}</span>
            <span className="text-lg font-semibold" style={{ color: f.color }}>
              {f.prefix}{formatted}{f.suffix}
            </span>
          </div>
        )
      })}
    </div>
  )
}
