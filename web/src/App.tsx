import { useState } from 'react'
import { AddWidgetDialog } from '@/components/add-widget-dialog'
import { ReportGrid } from '@/components/report-grid'
import { ReportList } from '@/components/report-list'
import { ThemeToggle } from '@/components/theme-toggle'
import { Separator } from '@/components/ui/separator'
import { ReportProvider, useReports } from '@/context/ReportContext'
import type { WidgetInstance } from '@/lib/types'
import { AppShell2 } from './components/rjsf'

function AppShell() {
  const { setActiveId } = useReports()
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

  const handleAddWidget = (id: string) => {
    setActiveId(id)
    setAddOpen(true)
  }

  return (
    <div className="flex h-screen bg-background">
      <aside className="flex w-60 flex-col border-r">
        <div className="flex items-center justify-between px-3 py-2">
          <h1 className="text-sm font-semibold">GreenCube</h1>
          <ThemeToggle />
        </div>
        <Separator />
        <div className="flex-1 overflow-auto">
          <ReportList onAddWidget={handleAddWidget} />
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-auto">
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
      <AppShell2 />
    </ReportProvider>
  )
}
