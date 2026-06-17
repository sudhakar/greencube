import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useReports } from '@/context/ReportContext'
import { createReport, deleteReport, updateReport } from '@/lib/storage'

interface ReportListProps {
  onAddWidget: (id: string) => void
}

export function ReportList({ onAddWidget }: ReportListProps) {
  const { reports, activeId, setActiveId, refresh } = useReports()
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const handleCreate = () => {
    if (!newTitle.trim()) return
    const r = createReport(newTitle.trim())
    setActiveId(r.id)
    setNewTitle('')
    setCreating(false)
    refresh()
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    deleteReport(id)
    if (activeId === id) setActiveId(null)
    refresh()
  }

  const handleRename = (id: string) => {
    if (!editTitle.trim()) return
    updateReport(id, { title: editTitle.trim() })
    setEditingId(null)
    refresh()
  }

  return (
    <div className="flex h-full flex-col gap-1 p-2">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-xs font-semibold uppercase text-muted-foreground">Reports</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCreating(true)}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      {creating && (
        <div className="flex gap-1 px-2">
          <Input
            autoFocus
            placeholder="Report name..."
            className="h-7 text-xs"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            onBlur={() => { if (!newTitle.trim()) setCreating(false) }}
          />
        </div>
      )}

      <div className="flex flex-col gap-0.5">
        {reports.map((r) => (
          <div
            key={r.id}
            className={`group flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm ${
              activeId === r.id ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
            }`}
            onClick={() => setActiveId(r.id)}
          >
            {editingId === r.id ? (
              <Input
                autoFocus
                className="h-6 text-xs"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRename(r.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                onBlur={() => setEditingId(null)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className="flex-1 truncate"
                onDoubleClick={() => { setEditingId(r.id); setEditTitle(r.title) }}
              >
                {r.title}
              </span>
            )}
            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={(e) => { e.stopPropagation(); onAddWidget(r.id) }}
              >
                <Plus className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={(e) => handleDelete(r.id, e)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
