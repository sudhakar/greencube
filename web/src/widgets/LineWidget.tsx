import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { axisTickStyle, chartColors, detectFieldType, formatValue, legendFormatter, tooltipProps } from './widget-theme'

export interface LineConfig {
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
  title?: { text: string; align?: 'left' | 'center' | 'right' }
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
  const titleText = config.title?.text
  const titleAlign = config.title?.align ?? 'center'

  return (
    <div className="flex h-full flex-col">
      {titleText && (
        <div className="drag-handle shrink-0 px-3 pt-1.5 pb-0" style={{ textAlign: titleAlign }}>
          <span className="truncate text-xs font-medium">{titleText}</span>
        </div>
      )}
      <div className="flex-1 min-h-0">
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
      </div>
    </div>
  )
}
