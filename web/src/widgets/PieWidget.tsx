import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { chartColors, formatValue, legendFormatter, tooltipProps } from './widget-theme'

interface PieConfig {
  labelField: string
  valueField: string
  donut?: boolean
  valueFormat?: string
  showPercent?: boolean
  showLegend?: boolean
  maxSlices?: number
}

interface PieWidgetProps {
  data: Record<string, unknown>[]
  config: PieConfig
}

export function PieWidget({ data, config }: PieWidgetProps) {
  if (!data.length) return null

  const labelField = config.labelField ?? Object.keys(data[0])[0]
  const valueField = config.valueField ?? Object.keys(data[0])[1]
  const chartData = data.slice(0, config.maxSlices ?? 10)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          dataKey={valueField}
          nameKey={labelField}
          cx="50%" cy="50%"
          innerRadius={config.donut ? 40 : 0}
          outerRadius={80}
          label={config.showPercent ? ({ value }) => `${((value as number) / chartData.reduce((a, b) => a + (b[valueField] as number), 0) * 100).toFixed(0)}%` : undefined}
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={chartColors[i % chartColors.length]} />
          ))}
        </Pie>
        {config.showLegend && <Legend formatter={legendFormatter} />}
        <Tooltip {...tooltipProps} formatter={(value) => formatValue(value, config.valueFormat, 'number')} />
      </PieChart>
    </ResponsiveContainer>
  )
}
