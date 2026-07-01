import { nanoid } from 'nanoid'
import { type LayoutItem } from 'react-grid-layout'
import type { Report, WidgetInstance, WidgetType } from './types'

const STORAGE_KEY = 'greencube-reports'

function loadAll(): Report[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveAll(reports: Report[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports))
}

export function getReports(): Report[] {
  return loadAll()
}

export function getReport(id: string): Report | undefined {
  return loadAll().find((r) => r.id === id)
}

export function createReport(title: string): Report {
  const now = Date.now()
  const report: Report = {
    id: nanoid(),
    title,
    widgets: [],
    layout: [],
    createdAt: now,
    updatedAt: now,
  }
  const reports = loadAll()
  reports.push(report)
  saveAll(reports)
  return report
}

export function updateReport(id: string, updates: Partial<Report>): Report | undefined {
  const reports = loadAll()
  const idx = reports.findIndex((r) => r.id === id)
  if (idx === -1) return undefined
  reports[idx] = { ...reports[idx], ...updates, updatedAt: Date.now() }
  saveAll(reports)
  return reports[idx]
}

export function deleteReport(id: string): void {
  const reports = loadAll().filter((r) => r.id !== id)
  saveAll(reports)
}

export function addWidget(
  reportId: string,
  type: WidgetType,
  title: string,
  query: object,
  config: object,
  layout?: Partial<LayoutItem>,
): { report: Report; widget: WidgetInstance } | undefined {
  const reports = loadAll()
  const idx = reports.findIndex((r) => r.id === reportId)
  if (idx === -1) return undefined

  const id = nanoid()
  const widget: WidgetInstance = { id, type, title, query, config }
  const reportsList = reports[idx].layout
  const maxY = reportsList.reduce((max, l) => Math.max(max, l.y + l.h), 0)
  const layoutItem: LayoutItem = {
    i: id,
    x: layout?.x ?? 0,
    y: layout?.y ?? maxY,
    w: layout?.w ?? 4,
    h: layout?.h ?? 3,
    minW: layout?.minW,
    minH: layout?.minH,
  }

  reports[idx].widgets.push(widget)
  reports[idx].layout.push(layoutItem)
  reports[idx].updatedAt = Date.now()
  saveAll(reports)
  return { report: reports[idx], widget }
}

export function updateWidget(
  reportId: string,
  widgetId: string,
  updates: Partial<WidgetInstance>,
): Report | undefined {
  const reports = loadAll()
  const rIdx = reports.findIndex((r) => r.id === reportId)
  if (rIdx === -1) return undefined
  const wIdx = reports[rIdx].widgets.findIndex((w) => w.id === widgetId)
  if (wIdx === -1) return undefined
  reports[rIdx].widgets[wIdx] = { ...reports[rIdx].widgets[wIdx], ...updates }
  reports[rIdx].updatedAt = Date.now()
  saveAll(reports)
  return reports[rIdx]
}

export function cloneWidget(
  reportId: string,
  widgetId: string,
  layoutOffset?: { x?: number; y?: number },
): { report: Report; widget: WidgetInstance } | undefined {
  const reports = loadAll()
  const rIdx = reports.findIndex((r) => r.id === reportId)
  if (rIdx === -1) return undefined
  const w = reports[rIdx].widgets.find((w) => w.id === widgetId)
  if (!w) return undefined
  const l = reports[rIdx].layout.find((l) => l.i === widgetId)
  if (!l) return undefined

  const newId = nanoid()
  const newWidget: WidgetInstance = { ...w, id: newId }
  const maxY = reports[rIdx].layout.reduce((max, li) => Math.max(max, li.y + li.h), 0)
  const newLayout: LayoutItem = {
    ...l,
    i: newId,
    x: layoutOffset?.x ?? l.x + (l.w > 4 ? 0 : 2),
    y: layoutOffset?.y ?? maxY,
  }

  reports[rIdx].widgets.push(newWidget)
  reports[rIdx].layout.push(newLayout)
  reports[rIdx].updatedAt = Date.now()
  saveAll(reports)
  return { report: reports[rIdx], widget: newWidget }
}

export function deleteWidget(reportId: string, widgetId: string): Report | undefined {
  const reports = loadAll()
  const rIdx = reports.findIndex((r) => r.id === reportId)
  if (rIdx === -1) return undefined
  reports[rIdx].widgets = reports[rIdx].widgets.filter((w) => w.id !== widgetId)
  reports[rIdx].layout = reports[rIdx].layout.filter((l) => l.i !== widgetId)
  reports[rIdx].updatedAt = Date.now()
  saveAll(reports)
  return reports[rIdx]
}

export function updateLayout(reportId: string, layout: LayoutItem[]): Report | undefined {
  return updateReport(reportId, { layout })
}

export function onStorageChange(cb: (reports: Report[]) => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb(loadAll())
  }
  window.addEventListener('storage', handler)
  return () => window.removeEventListener('storage', handler)
}
