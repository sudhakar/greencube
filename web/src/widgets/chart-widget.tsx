import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import type { WidgetType } from '@/lib/types'

interface ChartConfig {
  xField?: string
  yFields?: string[]
  stacked?: boolean
  horizontal?: boolean
  sortBy?: string
  sortDirection?: 'asc' | 'desc'
  limit?: number
  showLegend?: boolean
  showGrid?: boolean
  showValues?: boolean
  labelField?: string
  valueField?: string
  donut?: boolean
  showPercent?: boolean
  maxSlices?: number
}

interface ChartWidgetProps {
  type: WidgetType
  data: Record<string, unknown>[]
  config: ChartConfig
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))']

export function ChartWidget({ type, data, config }: ChartWidgetProps) {
  if (!data.length) return null

  if (type === 'pie') {
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
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          {config.showLegend && <Legend />}
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  const xField = config.xField ?? Object.keys(data[0])[0]
  const yFields = config.yFields ?? [Object.keys(data[0])[1]].filter(Boolean)
  const chartData = config.limit ? data.slice(0, config.limit) : data

  const commonProps = {
    data: chartData,
    margin: { top: 5, right: 5, left: 0, bottom: 5 },
  }

  const renderLines = () =>
    yFields.map((yf, i) => (
      type === 'bar' ? (
        <Bar key={yf} dataKey={yf} fill={COLORS[i % COLORS.length]} stackId={config.stacked ? 'stack' : undefined} />
      ) : type === 'area' ? (
        <Area key={yf} type="monotone" dataKey={yf} fill={COLORS[i % COLORS.length]} stroke={COLORS[i % COLORS.length]} stackId={config.stacked ? 'stack' : undefined} />
      ) : (
        <Line key={yf} type="monotone" dataKey={yf} stroke={COLORS[i % COLORS.length]} />
      )
    ))

  const Chart = type === 'bar' ? BarChart : type === 'area' ? AreaChart : LineChart

  return (
    <ResponsiveContainer width="100%" height="100%">
      <Chart {...commonProps}>
        {config.showGrid !== false && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
        <XAxis dataKey={xField} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        {config.showLegend !== false && <Legend />}
        {renderLines()}
      </Chart>
    </ResponsiveContainer>
  )
}
