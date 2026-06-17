import { useCallback } from 'react'
import GridLayout, { useContainerWidth } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import { useReports } from '@/context/ReportContext'
import { useWidgetData } from '@/hooks/useWidgetData'
import type { WidgetInstance, LayoutItem } from '@/lib/types'
import { ChartWidget } from '@/widgets/chart-widget'
import { GaugeWidget } from '@/widgets/gauge-widget'
import { MetricWidget } from '@/widgets/metric-widget'
import { NumberWidget } from '@/widgets/number-widget'
import { TableWidget } from '@/widgets/table-widget'
import { WidgetFrame } from './widget-frame'

interface WidgetRendererProps {
  widget: WidgetInstance
  onEdit?: () => void
  onClone?: () => void
  onDelete?: () => void
}

function WidgetRenderer({ widget, onEdit, onClone, onDelete }: WidgetRendererProps) {
  const { data, loading, error, refetch } = useWidgetData(widget.query)

  const hasData = !loading && !error && data.length > 0

  return (
    <WidgetFrame
      title={widget.title}
      loading={loading}
      error={error}
      hasData={hasData}
      onRetry={refetch}
      onEdit={onEdit}
      onClone={onClone}
      onDelete={onDelete}
    >
      {widget.type === 'number' && <NumberWidget data={data} config={widget.config as never} />}
      {widget.type === 'gauge' && <GaugeWidget data={data} config={widget.config as never} />}
      {(widget.type === 'bar' || widget.type === 'line' || widget.type === 'area' || widget.type === 'pie') && (
        <ChartWidget type={widget.type} data={data} config={widget.config as never} />
      )}
      {widget.type === 'table' && <TableWidget data={data} config={widget.config as never} />}
      {widget.type === 'metric' && <MetricWidget data={data} config={widget.config as never} />}
    </WidgetFrame>
  )
}

interface ReportGridProps {
  onEditWidget?: (widget: WidgetInstance) => void
}

export function ReportGrid({ onEditWidget }: ReportGridProps) {
  const { reports, activeId, patchLayout, removeWidget, duplicateWidget } = useReports()
  const report = reports.find((r) => r.id === activeId)

  const { width, containerRef } = useContainerWidth()

  const saveLayout = useCallback(
    (layout: readonly LayoutItem[]) => {
      if (activeId) patchLayout(activeId, layout.map((l) => ({ ...l })))
    },
    [activeId, patchLayout],
  )

  if (!report) {
    return (
      <div ref={containerRef as React.RefObject<HTMLDivElement | null>} className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select or create a report
      </div>
    )
  }

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement | null>} className="h-full w-full flex flex-col flex-1">
      {width > 0 && (
        <GridLayout
          width={width}
          layout={report.layout}
          onLayoutChange={saveLayout}
          onDragStop={(layout) => saveLayout(layout)}
          onResizeStop={(layout) => saveLayout(layout)}
          autoSize={false}
          gridConfig={{
            cols: 12,
            rowHeight: 120,
            margin: [10, 10] as [number, number],
            containerPadding: [10, 10] as [number, number],
          }}
        >
          {report.widgets.map((w) => (
            <div key={w.id}>
              <WidgetRenderer
                widget={w}
                onEdit={onEditWidget ? () => onEditWidget(w) : undefined}
                onClone={() => { if (activeId) duplicateWidget(activeId, w.id) }}
                onDelete={() => { if (activeId) removeWidget(activeId, w.id) }}
              />
            </div>
          ))}
        </GridLayout>
      )}
    </div>
  )
}
