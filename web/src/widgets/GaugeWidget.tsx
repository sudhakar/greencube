import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import { formatValue } from './widget-theme'

interface GaugeConfig {
  valueField: string
  min?: number
  max?: number
  thresholds?: { from: number; to: number; color: string }[]
  valueFormat?: string
}

interface GaugeWidgetProps {
  data: Record<string, unknown>[]
  config: GaugeConfig
}

export function GaugeWidget({ data, config }: GaugeWidgetProps) {
  if (!data.length) return null
  const valueField = config.valueField ?? Object.keys(data[0]).find((k) => typeof data[0][k] === 'number') ?? Object.keys(data[0])[0]
  const raw = data[0][valueField]
  const value = typeof raw === 'number' ? raw : Number(raw) || 0
  const min = config.min ?? 0
  const max = config.max ?? 100
  const clamped = Math.min(max, Math.max(min, value))
  const pct = max !== min ? ((clamped - min) / (max - min)) * 100 : 0

  let fill = 'var(--chart-1)'
  if (config.thresholds) {
    const match = config.thresholds.find((t) => value >= t.from && value <= t.to)
    if (match) fill = match.color
  }

  const formatted = config.valueFormat === 'percent' ? `${Math.round(pct)}%` : formatValue(value, config.valueFormat, 'number')

  const data01 = [
    { name: 'value', value: pct },
    { name: 'track', value: 100 - pct },
  ]

  return (
    <div className="flex h-full flex-col items-center justify-center gap-2">
      <div className="relative">
        <ResponsiveContainer width={140} height={140}>
          <PieChart>
            <Pie
              data={data01}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={65}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              isAnimationActive={false}
            >
              <Cell fill={fill} />
              <Cell fill="var(--border)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg font-bold" style={{ color: 'var(--foreground)' }}>
          {formatted}
        </div>
      </div>
    </div>
  )
}
