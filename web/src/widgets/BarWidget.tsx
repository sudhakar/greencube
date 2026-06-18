import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { fieldTitle } from '@/lib/meta'
import { axisTickStyle, chartColors, tooltipCursor, tooltipStyle } from './widget-theme'

interface BarConfig {
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

interface BarWidgetProps {
  data: Record<string, unknown>[]
  config: BarConfig
}

export function BarWidget({ data, config }: BarWidgetProps) {
  if (!data.length) return null

  const xField = config.xField ?? Object.keys(data[0])[0]
  const yFields = (config.yFields ?? [Object.keys(data[0])[1]]).filter(Boolean)
  const chartData = config.limit ? data.slice(0, config.limit) : data

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        {config.showGrid !== false && <CartesianGrid strokeDasharray="3 3" className="stroke-border" />}
        <XAxis dataKey={xField} tick={axisTickStyle} stroke="var(--border)" />
        <YAxis tick={axisTickStyle} stroke="var(--border)" />
        <Tooltip contentStyle={tooltipStyle} cursor={tooltipCursor} />
        {config.showLegend !== false && <Legend formatter={(value: string) => <span style={{ color: 'var(--foreground)' }}>{fieldTitle(value)}</span>} />}
        {yFields.map((yf, i) => (
          <Bar key={yf} dataKey={yf} fill={chartColors[i % chartColors.length]} stackId={config.stacked ? 'stack' : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
