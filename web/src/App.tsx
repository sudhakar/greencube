import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ReportProvider, useReports } from '@/context/ReportContext'
import { ReportList } from '@/components/report-list'
import { ReportGrid } from '@/components/report-grid'
import { AddWidgetDialog } from '@/components/add-widget-dialog'
import type { WidgetInstance } from '@/lib/types'

function AppShell() {
  const { activeId } = useReports()
  const [addOpen, setAddOpen] = useState(false)
  const [editingWidget, setEditingWidget] = useState<WidgetInstance | null>(null)

  const handleEdit = (widget: WidgetInstance) => {
    setEditingWidget(widget)
    setAddOpen(true)
  }

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setEditingWidget(null)
    }
    setAddOpen(open)
  }

  return (
    <div className="flex h-screen bg-background">
      <aside className="flex w-60 flex-col border-r">
        <div className="flex items-center justify-between px-3 py-2">
          <h1 className="text-sm font-semibold">GreenCube</h1>
        </div>
        <Separator />
        <div className="flex-1 overflow-auto">
          <ReportList />
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-auto">
        <header className="flex items-center justify-between border-b px-4 py-2">
          <span className="text-sm text-muted-foreground">
            {activeId ? 'Drag to reorder, resize freely' : 'No report selected'}
          </span>
          {activeId && (
            <Button size="sm" className="h-7 gap-1" onClick={() => setAddOpen(true)}>
              <Plus className="h-3 w-3" /> Add Widget
            </Button>
          )}
        </header>

        <div className="flex-1 p-4">
          <ReportGrid onEditWidget={handleEdit} />
        </div>
      </main>

      <AddWidgetDialog open={addOpen} onOpenChange={handleDialogClose} editingWidget={editingWidget} />
    </div>
  )
}

export default function App() {
  return (
    <ReportProvider>
      <AppShell />
    </ReportProvider>
  )
}
