import { IconArrowDown, IconArrowUp, IconPin, IconPinFilled, IconSelector, IconSettings } from '@tabler/icons-react'
import {
  type ColumnPinningState,
  type ColumnSizingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { type CSSProperties, memo, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { fieldTitle, fieldType } from '@/lib/meta'
import { cn } from '@/lib/utils'
import { formatValue } from './widget-theme'

interface ColumnFormat {
  field: string
  format?: string
  prefix?: string
  precision?: number
}

export interface TableConfig {
  columnFormats?: ColumnFormat[]
  title?: { text: string; align?: 'left' | 'center' | 'right' }
}

interface TableWidgetProps {
  data: Record<string, unknown>[]
  config?: TableConfig
}

const SORT_ICONS = {
  asc: <IconArrowUp size={12} />,
  desc: <IconArrowDown size={12} />,
  none: <IconSelector size={12} />,
} as const

const ROW_H = 26
const COL_W = 150

const CELL_CLASSES = [
  'truncate', 'px-1', 'py-1', 'text-xs', 'inline-block',
  'box-border', 'align-top', 'h-full', 'border-border'
].join(' ')
const PINNED_CLASSES = CELL_CLASSES + ' sticky z-[1] bg-muted'

const BODY_CELL_CLASSES = CELL_CLASSES + ' border-t'
const BODY_PINNED_CLASSES = PINNED_CLASSES + ' border-t'
const LAST_BODY_CELL_CLASSES = CELL_CLASSES
const LAST_BODY_PINNED_CLASSES = PINNED_CLASSES

/* perf counters (reset per render cycle) */
let perfCellCalls = 0
let perfCellNs = 0

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function formatCell(
  raw: unknown,
  colId: string,
  formatMap: Record<string, { format: string; prefix?: string; precision?: number }>,
  fieldTypes: Record<string, string>,
): string {
  const t0 = performance.now()
  const fm = formatMap[colId]
  if (!fm) { perfCellCalls++; perfCellNs += performance.now() - t0; return String(raw ?? '') }
  const { format: fmt, prefix, precision } = fm
  const ft = fieldTypes[colId] ?? 'string'
  const norm = ft === 'time' ? 'time' : ft === 'number' || ft === 'integer' || ft === 'float' ? 'number' : 'string'
  const r = String(formatValue(raw, fmt, norm, prefix, precision))
  perfCellCalls++; perfCellNs += performance.now() - t0
  return r
}

/* ── Virtual row (memoized by row.id ── scrolled-out rows don't re-render) ── */
interface VirtualRowProps {
  row: Record<string, unknown>
  pinnedIds: string[]
  centerIds: string[]
  colWidths: Record<string, number>
  pinOffsets: Record<string, number>
  formatMap: Record<string, { format: string; prefix?: string; precision?: number }>
  fieldTypes: Record<string, string>
  totalWidth: number
  rowHeight: number
  isLastRow?: boolean
}

const VirtualRow = memo(function VirtualRow({
  row,
  pinnedIds,
  centerIds,
  colWidths,
  pinOffsets,
  formatMap,
  fieldTypes,
  totalWidth,
  rowHeight,
  isLastRow,
}: VirtualRowProps) {
  const html = useMemo(() => {
    const colIds = [...pinnedIds, ...centerIds]
    let h = ''
    for (const id of colIds) {
      const isPinned = pinnedIds.includes(id)
      const val = escapeHtml(formatCell(row[id], id, formatMap, fieldTypes))
      const baseCls = isPinned
        ? (isLastRow ? LAST_BODY_PINNED_CLASSES : BODY_PINNED_CLASSES)
        : (isLastRow ? LAST_BODY_CELL_CLASSES : BODY_CELL_CLASSES)
      let styleStr = `width:${colWidths[id]}px`
      if (isPinned) {
        styleStr += `;left:${pinOffsets[id]}px`
      }
      h += `<span class="${baseCls}" style="${styleStr}">${val}</span>`
    }
    return h
  }, [row, pinnedIds, centerIds, colWidths, pinOffsets, formatMap, fieldTypes, isLastRow])

  return (
    <div
      className="whitespace-nowrap contain-layout"
      style={{ height: rowHeight, width: totalWidth, lineHeight: 0 }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})

/* ── Flyweight — only this re-renders on scroll via useVirtualizer ── */
function VirtualRowsContainer({
  data,
  pinnedIds,
  centerIds,
  colWidths,
  pinOffsets,
  formatMap,
  fieldTypes,
  totalWidth,
  scrollRef,
}: {
  data: Record<string, unknown>[]
  pinnedIds: string[]
  centerIds: string[]
  colWidths: Record<string, number>
  pinOffsets: Record<string, number>
  formatMap: Record<string, { format: string; prefix?: string; precision?: number }>
  fieldTypes: Record<string, string>
  totalWidth: number
  scrollRef: React.RefObject<HTMLDivElement | null>
}) {
  const rowVirt = useVirtualizer({
    count: data.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 50,
  })

  /* Force re-measure after mount when layout is settled */
  useEffect(() => { rowVirt.measure() }, [rowVirt])

  /* Timing */
  const renderStart = useRef(0)
  renderStart.current = performance.now()

  const vitems = rowVirt.getVirtualItems()

  useEffect(() => {
    const elapsed = performance.now() - renderStart.current
    if (elapsed > 16) {
      console.log('[perf] VRC render', elapsed.toFixed(1), 'ms, vitems=' + vitems.length + ', getVirtualItems range:', vitems[0]?.index, '-', vitems[vitems.length - 1]?.index)
    }
  })

  return (
    <div className="relative" style={{ height: rowVirt.getTotalSize() }}>
      {vitems.map((vitem) => {
        const row = data[vitem.index]
        return (
          <div
            key={vitem.key}
            className="absolute top-0 left-0"
            style={{
              transform: `translateY(${vitem.start}px)`,
              width: totalWidth,
            }}
          >
            <VirtualRow
              row={row}
              pinnedIds={pinnedIds}
              centerIds={centerIds}
              colWidths={colWidths}
              pinOffsets={pinOffsets}
              formatMap={formatMap}
              fieldTypes={fieldTypes}
              totalWidth={totalWidth}
              rowHeight={vitem.size}
              isLastRow={false}
            />
          </div>
        )
      })}
    </div>
  )
}

/* ── Outer widget ── */
export function TableWidget({ data, config }: TableWidgetProps) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const [colSizing, setColSizing] = useState<ColumnSizingState>({})
  const [colPinning, setColPinning] = useState<ColumnPinningState>({ left: [], right: [] })
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isOpen, setOpen] = useState(false)
  const [showRows, setShowRows] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setShowRows(true)) }, [])

  const formatMap = useMemo(() => {
    const map: Record<string, { format: string; prefix?: string; precision?: number }> = {}
    if (config?.columnFormats) {
      for (const cf of config.columnFormats) {
        if (cf.field) map[cf.field] = { format: cf.format ?? '', prefix: cf.prefix, precision: cf.precision }
      }
    }
    return map
  }, [config])

  const table = useReactTable({
    data,
    columns: useMemo(() => {
      if (!data.length) return []
      return Object.keys(data[0]).map((key) => ({
        id: key,
        accessorFn: (r: Record<string, unknown>) => r[key],
        header: fieldTitle(key),
        size: COL_W,
        enableResizing: true,
        enablePinning: true,
      }))
    }, [data]),
    state: { sorting, globalFilter, columnPinning: colPinning },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnSizingChange: setColSizing,
    onColumnPinningChange: setColPinning,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    enablePinning: true,
    defaultColumn: { size: COL_W },
  })

  /* Stable column IDs — only change on data or pinning, not on scroll */
  const allColIds = useMemo(
    () => table.getAllLeafColumns().filter(c => c.getIsVisible()).map(c => c.id),
    [data, colPinning],
  )
  const pinnedIds = useMemo(
    () => allColIds.filter(id => table.getAllLeafColumns().find(c => c.id === id)?.getIsPinned() === 'left'),
    [allColIds, colPinning],
  )
  const centerIds = useMemo(
    () => allColIds.filter(id => !pinnedIds.includes(id)),
    [allColIds, pinnedIds],
  )

  /* Pre-computed field types — avoids per-cell linear metadata lookup */
  const fieldTypes = useMemo(() => {
    const ft: Record<string, string> = {}
    for (const id of allColIds) ft[id] = fieldType(id) ?? 'string'
    return ft
  }, [allColIds])

  /* Stable derived data */
  const colWidths = useMemo(() => {
    const w: Record<string, number> = {}
    for (const id of allColIds) w[id] = colSizing[id] ?? COL_W
    return w
  }, [allColIds, colSizing])

  const pinOffsets = useMemo(() => {
    const o: Record<string, number> = {}
    let cum = 0
    for (const id of pinnedIds) {
      o[id] = cum
      cum += colWidths[id]
    }
    return o
  }, [pinnedIds, colWidths])

  const totalWidth = useMemo(
    () => allColIds.reduce((s, id) => s + colWidths[id], 0),
    [allColIds, colWidths],
  )

  const rows = table.getRowModel().rows.map(r => r.original)

  /* Pin toggle uses column IDs, not column objects */
  const handlePinToggle = (colId: string) => {
    const col = table.getAllLeafColumns().find(c => c.id === colId)
    if (!col) return
    if (col.getIsPinned() === 'left') col.pin(false)
    else col.pin('left')
  }

  /* ── Post-render perf log ── */
  const renderCount = useRef(0)
  useEffect(() => {
    renderCount.current++
    console.log(
      `[perf] render #${renderCount.current}  ` +
      `rows=${rows.length}  ` +
      `formatCellCalls=${perfCellCalls}  ` +
      `formatCellTime=${perfCellNs.toFixed(1)}ms`,
    )
    perfCellCalls = 0
    perfCellNs = 0
  })

  /* ── Track active resize column for cursor/highlight ── */
  const resizingCol = table.getState().columnSizingInfo?.isResizingColumn

  /* ── Render ── */
  if (!data.length) return null
  const titleText = config?.title?.text
  const titleAlign = config?.title?.align ?? 'center'
  const style: CSSProperties = titleAlign === 'left'
    ? { order: 0 }
    : titleAlign === 'right'
      ? { order: 2, textAlign: 'right' }
      : { order: 1, margin: '0 auto', textAlign: 'center' }

  return (
    <div className="flex flex-col absolute inset-0" ref={containerRef}>

      <div className="flex gap-2 items-center py-2 px-4">
        {titleText && (
          <div className="drag-handle shrink-0" style={{ ...style, flex: 1 }}>
            <span className="truncate text-xs font-medium">{titleText}</span>
          </div>
        )}
        <Input
          placeholder="Search..."
          className="h-6 px-2 md:text-[12px] w-40"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
        />

        <Button variant="ghost" size="icon-xs" onClick={() => setOpen(o => !o)} ><IconSettings /></Button>
      </div>

      <div ref={scrollRef} className="isolate flex-1 overflow-auto" style={{ cursor: resizingCol ? 'col-resize' : undefined }}>
        <div style={{ width: totalWidth, minWidth: '100%' }}>
          {/* ── Header ── */}
          <div className="sticky top-0 z-10 bg-border backdrop-blur-xl whitespace-nowrap">
            {[...pinnedIds, ...centerIds].map((id) => {
              const col = table.getAllLeafColumns().find(c => c.id === id)!
              const h = table.getHeaderGroups()[0].headers.find(h => h.column.id === id)
              const isPinned = pinnedIds.includes(id)
              return (
                <div
                  key={id}
                  className={cn(
                    'inline-flex items-center gap-0.5 px-1 py-1 text-xs font-medium select-none truncate shrink-0 box-border border-r last:border-r-0 cursor-pointer align-top',
                    isPinned ? 'sticky bg-muted' : 'relative',
                  )}
                  style={{
                    width: colWidths[id],
                    ...(isPinned ? { left: pinOffsets[id], zIndex: 12 } : {}),
                  }}
                  onClick={col.getToggleSortingHandler()}
                >
                  <span className="truncate">
                    {flexRender(col.columnDef.header, h!.getContext()) as ReactNode}
                  </span>
                  <span className="opacity-40 shrink-0">
                    {SORT_ICONS[col.getIsSorted() as keyof typeof SORT_ICONS || 'none']}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePinToggle(id) }}
                    className="ml-auto opacity-20 hover:opacity-100 shrink-0 p-0.5"
                  >
                    {isPinned ? <IconPinFilled size={12} /> : <IconPin size={12} />}
                  </button>
                  {col.getCanResize() && h && (
                    <div
                      onMouseDown={h.getResizeHandler()}
                      onTouchStart={h.getResizeHandler()}
                      className={'absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none' + (resizingCol === id ? ' bg-primary' : ' hover:bg-primary/50')}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* ── Body — deferred to next frame so header paints first ── */}
          {showRows
            ? <VirtualRowsContainer
              data={rows}
              pinnedIds={pinnedIds}
              centerIds={centerIds}
              colWidths={colWidths}
              pinOffsets={pinOffsets}
              formatMap={formatMap}
              fieldTypes={fieldTypes}
              totalWidth={totalWidth}
              scrollRef={scrollRef}
            />
            : <div style={{ height: rows.length * ROW_H }} />
          }
        </div>
      </div>

      <Sheet modal={false} open={isOpen} onOpenChange={(o) => setOpen(o)} disablePointerDismissal >
        <SheetContent container={containerRef} hideOverlay style={{ position: 'absolute' }} className="bg-card">
          <SheetHeader>
            <SheetTitle>Are you absolutely sure?</SheetTitle>
            <SheetDescription>This action cannot be undone.</SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>


    </div>
  )
}
