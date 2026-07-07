import { formatValue } from './widget-theme'

export interface NumberConfig {
  valueField: string
  trendField?: string
  trendLabel?: string
  prefix?: string
  suffix?: string
  decimals?: number
  color?: string
  valueFormat?: string
  title?: { text: string; align?: 'left' | 'center' | 'right' }
}

interface NumberWidgetProps {
  data: Record<string, unknown>[]
  config: NumberConfig
}

export function NumberWidget({ data, config }: NumberWidgetProps) {
  if (!data.length) return null
  const valueField = config.valueField ?? Object.keys(data[0]).find((k) => typeof data[0][k] === 'number') ?? Object.keys(data[0])[0]
  const raw = data[0][valueField]
  const value = typeof raw === 'number' ? raw : Number(raw)
  const trend = config.trendField ? (data[0][config.trendField] as number | undefined) : undefined
  const formatted = isNaN(value) ? '—' : formatValue(value, config.valueFormat, 'number')
  const titleText = config.title?.text
  const titleAlign = config.title?.align ?? 'center'

  return (
    <div className="flex h-full flex-col">
      {titleText && (
        <div className="drag-handle shrink-0 px-3 pt-1.5 pb-0" style={{ textAlign: titleAlign }}>
          <span className="truncate text-xs font-medium">{titleText}</span>
        </div>
      )}
      <div className="flex flex-1 flex-col items-center justify-center gap-1">
        <span className="text-3xl font-bold" style={{ color: config.color }}>
          {config.prefix}{formatted}{config.suffix}
        </span>
        {trend !== undefined && (
          <span className={`text-sm ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {config.trendLabel ? `${config.trendLabel}: ` : ''}{trend >= 0 ? '+' : ''}{trend}
          </span>
        )}
      </div>
    </div>
  )
}
