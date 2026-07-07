import { useCallback } from 'react'
import GridLayout, { type LayoutItem, useContainerWidth } from 'react-grid-layout'
import { useReports } from '@/context/ReportContext'
import { useFetch } from '@/hooks/useFetch'
import type { WidgetInstance } from '@/lib/types'
import { AreaWidget } from '@/widgets/AreaWidget'
import { BarWidget } from '@/widgets/BarWidget'
import { LineWidget } from '@/widgets/LineWidget'
import { NumberWidget } from '@/widgets/NumberWidget'
import { PieWidget } from '@/widgets/PieWidget'
import { TableWidget } from '@/widgets/TableWidget'
import { WidgetFrame } from './widget-frame'

interface WidgetRendererProps {
  widget: WidgetInstance
  onEdit?: () => void
  onClone?: () => void
  onDelete?: () => void
}

function WidgetRenderer({ widget, onEdit, onClone, onDelete }: WidgetRendererProps) {
  const { data, isLoading, error, refetch } = useFetch(widget.query)

  const hasData = !isLoading && !error && data.length > 0

  return (
    <WidgetFrame
      title={widget.title}
      loading={isLoading}
      error={error}
      hasData={hasData}
      onRetry={refetch}
      onEdit={onEdit}
      onClone={onClone}
      onDelete={onDelete}
    >
      {widget.type === 'number' && <NumberWidget data={data} config={widget.config as never} />}
      {widget.type === 'bar' && <BarWidget data={data} config={widget.config as never} />}
      {widget.type === 'line' && <LineWidget data={data} config={widget.config as never} />}
      {widget.type === 'area' && <AreaWidget data={data} config={widget.config as never} />}
      {widget.type === 'pie' && <PieWidget data={data} config={widget.config as never} />}
      {widget.type === 'table' && <TableWidget data={data} config={widget.config as never} />}
    </WidgetFrame>
  )
}

interface ReportGridProps {
  onEditWidget?: (widget: WidgetInstance) => void
}

const cleanLayout = (items: readonly LayoutItem[]) =>
  items.map((l) => { const c = { ...(l as LayoutItem) }; delete c.resizeHandles; return c })

export function ReportGrid({ onEditWidget }: ReportGridProps) {
  const { reports, activeId, patchLayout, removeWidget, duplicateWidget } = useReports()
  const report = reports.find((r) => r.id === activeId)

  const { width, containerRef } = useContainerWidth()

  const saveLayout = useCallback(
    (layout: readonly LayoutItem[]) => {
      if (activeId) patchLayout(activeId, cleanLayout(layout))
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
          layout={cleanLayout(report.layout)}
          onLayoutChange={saveLayout}
          onDragStop={(layout) => saveLayout(layout)}
          onResizeStop={(layout) => saveLayout(layout)}
          autoSize={true}
          dragConfig={{ handle: '.drag-handle', enabled: true }}
          resizeConfig={{ handles: ['e', 'w', 's', 'n', 'se', 'sw', 'ne', 'nw'], enabled: true }}

          gridConfig={{
            cols: 40,
            rowHeight: 12,
            margin: [15, 15] as [number, number],
            containerPadding: [0, 0] as [number, number],
          }}
          style={{ color: 'inherit' }}
        >
          {report.widgets.map((w) => (
            <div key={w.id} data-key={w.id}>
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
