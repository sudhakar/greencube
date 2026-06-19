import { fieldTitle } from '@/lib/meta'
import { formatValue } from './widget-theme'

interface MetricField {
  label: string
  valueField: string
  prefix?: string
  suffix?: string
  color?: string
  valueFormat?: string
}

interface MetricConfig {
  fields: MetricField[]
}

interface MetricWidgetProps {
  data: Record<string, unknown>[]
  config: MetricConfig
}

export function MetricWidget({ data, config }: MetricWidgetProps) {
  if (!data.length) return null

  const fields: MetricField[] = config.fields?.length
    ? config.fields
    : Object.keys(data[0])
      .filter((k) => typeof data[0][k] === 'number')
      .map((k) => ({ label: fieldTitle(k), valueField: k }))

  if (!fields.length) return null

  return (
    <div className="flex h-full flex-col justify-center gap-3 p-2">
      {fields.map((f, i) => {
        const effectiveField = f.valueField in data[0] ? f.valueField : Object.keys(data[0]).find((k) => typeof data[0][k] === 'number') ?? Object.keys(data[0])[0]
        const raw = data[0][effectiveField]
        const value = typeof raw === 'number' ? raw : Number(raw)
        const formatted = isNaN(value) ? '—' : formatValue(value, f.valueFormat, 'number')
        return (
          <div key={i} className="flex flex-col items-center gap-2">
            <span className="text-lg font-semibold" style={{ color: f.color }}>
              {f.prefix}{formatted}{f.suffix}
            </span>
            <span className="text-sm text-muted-foreground">{f.label}</span>
          </div>
        )
      })}
    </div>
  )
}
