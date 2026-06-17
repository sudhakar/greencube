import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { fieldTitle } from '@/lib/meta'
import { axisTickStyle, chartColors, tooltipStyle } from './widget-theme'

interface LineConfig {
  xField: string
  yFields: string[]
  stacked?: boolean
  horizontal?: boolean
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
  limit?: number
  showLegend?: boolean
  showGrid?: boolean
  showValues?: boolean
}

interface LineWidgetProps {
  data: Record<string, unknown>[]
  config: LineConfig
}

export function LineWidget({ data, config }: LineWidgetProps) {
  if (!data.length) return null

  const xField = config.xField ?? Object.keys(data[0])[0]
  const yFields = config.yFields ?? [Object.keys(data[0])[1]].filter(Boolean)
  const chartData = config.limit ? data.slice(0, config.limit) : data

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        {config.showGrid !== false && <CartesianGrid strokeDasharray="3 3" className="stroke-border" />}
        <XAxis dataKey={xField} tick={axisTickStyle} stroke="var(--border)" />
        <YAxis tick={axisTickStyle} stroke="var(--border)" />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--muted)', stroke: 'var(--border)' }} />
        {config.showLegend !== false && <Legend formatter={(value: string) => <span style={{ color: 'var(--foreground)' }}>{fieldTitle(value)}</span>} />}
        {yFields.map((yf, i) => (
          <Line key={yf} type="monotone" dataKey={yf} stroke={chartColors[i % chartColors.length]} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
