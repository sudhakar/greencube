import { useState } from 'react'
import { Input } from '@/components/ui/input'

interface TableConfig {
  pageSize?: number
  sortable?: boolean
  searchable?: boolean
  wrapLines?: boolean
}

interface TableWidgetProps {
  data: Record<string, unknown>[]
  config: TableConfig
}

export function TableWidget({ data, config }: TableWidgetProps) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)

  if (!data.length) return null

  const columns = Object.keys(data[0])
  const pageSize = config.pageSize ?? 20

  let filtered = data
  if (config.searchable && search) {
    const q = search.toLowerCase()
    filtered = data.filter((row) =>
      Object.values(row).some((v) => String(v).toLowerCase().includes(q)),
    )
  }

  if (config.sortable && sortKey) {
    filtered = [...filtered].sort((a, b) => {
      const av = a[sortKey] as number
      const bv = b[sortKey] as number
      return sortDir === 'asc' ? (av > bv ? 1 : -1) : av < bv ? 1 : -1
    })
  }

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize)

  const handleSort = (key: string) => {
    if (!config.sortable) return
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden">
      {config.searchable && (
        <Input
          placeholder="Search..."
          className="h-7 text-xs"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
        />
      )}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted">
              {columns.map((c) => (
                <th
                  key={c}
                  className={`cursor-pointer px-2 py-1 text-left font-medium ${config.sortable ? 'hover:text-foreground' : ''}`}
                  onClick={() => handleSort(c)}
                >
                  {c}
                  {sortKey === c && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr key={i} className="border-t">
                {columns.map((c) => (
                  <td key={c} className={`px-2 py-1 ${config.wrapLines ? '' : 'whitespace-nowrap'}`}>
                    {String(row[c] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{filtered.length} rows</span>
          <div className="flex gap-1">
            <button disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="px-1 disabled:opacity-50">‹</button>
            <span>Page {page + 1} / {totalPages}</span>
            <button disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)} className="px-1 disabled:opacity-50">›</button>
          </div>
        </div>
      )}
    </div>
  )
}
