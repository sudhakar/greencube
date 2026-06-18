import { useMemo, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { fieldTitle } from '@/lib/meta'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type SortingState,
} from '@tanstack/react-table'

interface TableWidgetProps {
  data: Record<string, unknown>[]
}

export function TableWidget({ data }: TableWidgetProps) {
  const [globalFilter, setGlobalFilter] = useState('')
  const [sorting, setSorting] = useState<SortingState>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  const columns = useMemo(() => {
    if (!data.length) return []
    return Object.keys(data[0]).map((key) => ({
      id: key,
      accessorFn: (row: Record<string, unknown>) => row[key],
      header: fieldTitle(key),
    }))
  }, [data])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
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
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      <Input
        placeholder="Search..."
        className="h-7 text-xs"
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
      />
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          <div
            className="sticky top-0 z-10 bg-muted"
            style={{ display: 'grid', gridTemplateColumns: `repeat(${numCols}, minmax(0, 1fr))` }}
          >
            {table.getHeaderGroups().flatMap((hg) => hg.headers).map((header) => (
              <div
                key={header.id}
                className="cursor-pointer select-none px-2 py-1 text-xs font-medium hover:text-foreground"
                onClick={header.column.getToggleSortingHandler()}
              >
                {String(header.column.columnDef.header ?? '')}
                {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? ''}
              </div>
            ))}
          </div>
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
                    {String(cell.getValue() ?? '')}
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
