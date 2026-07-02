import { IconArrowDown, IconArrowUp, IconSelector } from '@tabler/icons-react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { type ReactNode, useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { fieldTitle, fieldType } from '@/lib/meta'
import { formatValue } from './widget-theme'

interface ColumnFormat {
  field: string
  format?: string
  prefix?: string
  precision?: number
}

interface TableConfig {
  columnFormats?: ColumnFormat[]
}

interface TableWidgetProps {
  data: Record<string, unknown>[]
  config?: TableConfig
}

const CARET_MAP = {
  asc: <IconArrowUp size={12} />,
  desc: <IconArrowDown size={12} />,
  none: <IconSelector size={12} />,
} as const

export function TableWidget({ data, config }: TableWidgetProps) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const formatMap = useMemo(() => {
    const map: Record<string, { format: string; prefix?: string; precision?: number }> = {}
    if (config?.columnFormats) {
      for (const cf of config.columnFormats) {
        if (cf.field) map[cf.field] = { format: cf.format ?? '', prefix: cf.prefix, precision: cf.precision }
      }
    }
    return map
  }, [config])

  const columns = useMemo(() => {
    if (!data.length) return []
    return Object.keys(data[0]).map((key) => ({
      id: key,
      accessorFn: (row: Record<string, unknown>) => row[key],
      header: fieldTitle(key),
      cell: (info: { getValue: () => unknown }) => {
        const raw = info.getValue()
        const fm = formatMap[key]
        const fmt = fm?.format ?? ''
        const prefix = fm?.prefix
        const precision = fm?.precision
        const ft = fieldType(key)
        const norm = ft === 'time' ? 'time' : ft === 'number' || ft === 'integer' || ft === 'float' ? 'number' : 'string'
        return String(formatValue(raw, fmt, norm, prefix, precision))
      },
    }))
  }, [data, formatMap])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableColumnResizing: true,
  })

  const rows = table.getRowModel().rows
  const numCols = table.getVisibleFlatColumns().length

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 28,
    overscan: 10,
  })

  if (!data.length) return null

  return (
    <div className="relative flex h-full flex-col gap-0 overflow-hidden" style={{ ['--table-header-height' as never]: '28px' }}>
      <div className="flex gap-2 items-center justify-between pt-1 pb-3 px-3 text-[8px]">
        <h4 className="flex-1 text-nowrap text-xs">Table tiltle</h4>
        <Input
          placeholder="Search..."
          className="h-6 px-1.5 md:text-[12px] w-40"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
        />
      </div>

      <div
        className="bg-muted/40"
        style={{ display: 'grid', gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))` }}
      >
        {table.getHeaderGroups().flatMap((hg) => hg.headers).map((header) => (
          <div
            key={header.id}
            className="cursor-pointer select-none flex items-center justify-between px-2 py-1 text-xs font-medium"
            onClick={header.column.getToggleSortingHandler()}
          >
            {String(header.column.columnDef.header ?? '')}

            {CARET_MAP[header.column.getIsSorted() as ('asc' | 'desc') || 'none']}
          </div>
        ))}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vitem) => {
            const row = rows[vitem.index]
            return (
              <div
                key={row.id}
                className="border-t"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: `${vitem.size}px`,
                  display: 'grid',
                  gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))`,
                  transform: `translateY(${vitem.start}px)`,
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <div key={cell.id} className="truncate px-2 py-1 text-xs">
                    {flexRender(cell.column.columnDef.cell, cell.getContext()) as ReactNode}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
