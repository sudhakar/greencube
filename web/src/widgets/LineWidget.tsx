import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { axisTickStyle, chartColors, detectFieldType, formatValue, legendFormatter, tooltipProps } from './widget-theme'

interface LineConfig {
  xField: string
  yFields: string[]
  xFormat?: string
  yFormat?: string
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
  const yFields = (config.yFields ?? [Object.keys(data[0])[1]]).filter(Boolean)
  const chartData = config.limit ? data.slice(0, config.limit) : data

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
        {config.showGrid !== false && <CartesianGrid strokeDasharray="3 3" className="stroke-border filter brightness-150" />}
        <XAxis dataKey={xField} tick={axisTickStyle} height={15} stroke="var(--border)" tickFormatter={(v) => formatValue(v, config.xFormat, detectFieldType(xField))} />
        <YAxis tick={axisTickStyle} stroke="var(--border)" width="auto" tickFormatter={(v) => formatValue(v, config.yFormat, 'number')} />
        <Tooltip {...tooltipProps} />
        {config.showLegend !== false && <Legend formatter={legendFormatter} />}
        {yFields.map((yf, i) => (
          <Line key={yf} type="monotone" dataKey={yf} stroke={chartColors[i % chartColors.length]} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
