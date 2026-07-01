import { cloneWidget, deleteWidget, getReports, onStorageChange, updateLayout } from '@/lib/storage'
import type { Report } from '@/lib/types'
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react'
import { type LayoutItem } from 'react-grid-layout'

interface ReportContextValue {
  reports: Report[]
  activeId: string | null
  setActiveId: (id: string | null) => void
  refresh: () => void
  patchLayout: (reportId: string, layout: LayoutItem[]) => void
  removeWidget: (reportId: string, widgetId: string) => void
  duplicateWidget: (reportId: string, widgetId: string) => void
}

const ReportContext = createContext<ReportContextValue | null>(null)

export function ReportProvider({ children }: { children: ReactNode }) {
  const [reports, setReports] = useState<Report[]>(() => getReports())
  const [activeId, setActiveId] = useState<string | null>(null)

  const refresh = useCallback(() => setReports(getReports()), [])

  const patchLayout = useCallback((reportId: string, layout: LayoutItem[]) => {
    updateLayout(reportId, layout)
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, layout, updatedAt: Date.now() } : r)),
    )
  }, [])

  const removeWidget = useCallback((reportId: string, widgetId: string) => {
    deleteWidget(reportId, widgetId)
    setReports((prev) =>
      prev.map((r) =>
        r.id === reportId
          ? { ...r, widgets: r.widgets.filter((w) => w.id !== widgetId), layout: r.layout.filter((l) => l.i !== widgetId), updatedAt: Date.now() }
          : r,
      ),
    )
  }, [])

  const duplicateWidget = useCallback((reportId: string, widgetId: string) => {
    cloneWidget(reportId, widgetId)
    setReports((prev) => prev.map((r) => (r.id === reportId ? getReports().find((x) => x.id === reportId)! : r)))
  }, [])

  useEffect(() => {
    const unsub = onStorageChange((r) => setReports(r))
    return unsub
  }, [])

  return (
    <ReportContext.Provider value={{ reports, activeId, setActiveId, refresh, patchLayout, removeWidget, duplicateWidget }}>
      {children}
    </ReportContext.Provider>
  )
}

export function useReports() {
  const ctx = useContext(ReportContext)
  if (!ctx) throw new Error('useReports must be used within ReportProvider')
  return ctx
}
