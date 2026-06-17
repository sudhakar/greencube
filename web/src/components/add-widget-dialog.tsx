import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useReports } from '@/context/ReportContext'
import { addWidget, updateWidget } from '@/lib/storage'
import { fetchMeta, executeQuery } from '@/lib/api'
import type { WidgetType, CubeMeta, WidgetInstance } from '@/lib/types'

const WIDGET_TYPES: { type: WidgetType; label: string; desc: string }[] = [
  { type: 'number', label: 'Number', desc: 'Single value with optional trend' },
  { type: 'gauge', label: 'Gauge', desc: 'Value within a range' },
  { type: 'bar', label: 'Bar Chart', desc: 'Categorical comparison' },
  { type: 'line', label: 'Line Chart', desc: 'Trend over time' },
  { type: 'area', label: 'Area Chart', desc: 'Filled trend' },
  { type: 'pie', label: 'Pie Chart', desc: 'Proportions' },
  { type: 'table', label: 'Table', desc: 'Tabular data' },
  { type: 'metric', label: 'Metric', desc: 'Multiple key values' },
]

const DEFAULT_QUERY = JSON.stringify({ measures: [], dimensions: [], timeDimensions: [] }, null, 2)

interface AddWidgetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingWidget?: WidgetInstance | null
}

export function AddWidgetDialog({ open, onOpenChange, editingWidget }: AddWidgetDialogProps) {
  const { activeId, refresh } = useReports()
  const isEditing = !!editingWidget

  const [step, setStep] = useState(0)
  const [widgetType, setWidgetType] = useState<WidgetType | null>(null)
  const [title, setTitle] = useState('')
  const [queryText, setQueryText] = useState(DEFAULT_QUERY)
  const [meta, setMeta] = useState<CubeMeta | null>(null)
  const [previewData, setPreviewData] = useState<Record<string, unknown>[] | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [x, setX] = useState(0)
  const [y, setY] = useState(0)
  const [w, setW] = useState(4)
  const [h, setH] = useState(3)

  useEffect(() => {
    if (editingWidget) {
      setWidgetType(editingWidget.type)
      setTitle(editingWidget.title)
      setQueryText(JSON.stringify(editingWidget.query, null, 2))
      setStep(1)
      loadMeta()
    }
  }, [editingWidget])

  const handleClose = (open: boolean) => {
    onOpenChange(open)
    if (!open) {
      setStep(0)
      setWidgetType(null)
      setTitle('')
      setQueryText(DEFAULT_QUERY)
      setPreviewData(null)
      setX(0); setY(0); setW(4); setH(3)
    }
  }

  const handlePreview = async () => {
    try {
      setPreviewLoading(true)
      const query = JSON.parse(queryText)
      const result = await executeQuery(query)
      setPreviewData(result.data)
    } catch {
      setPreviewData([])
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleFinish = () => {
    if (!widgetType || !activeId) return
    const query = JSON.parse(queryText)

    if (isEditing && editingWidget) {
      updateWidget(activeId, editingWidget.id, {
        title: title || widgetType,
        type: widgetType,
        query,
      })
    } else {
      addWidget(activeId, widgetType, title || widgetType, query, {}, { x, y, w, h })
    }
    refresh()
    handleClose(false)
  }

  const loadMeta = async () => {
    if (!meta) {
      try { setMeta(await fetchMeta()) } catch { /* ignore */ }
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Widget' : step === 0 ? 'Pick Widget Type' : step === 1 ? 'Configure Query' : 'Layout'}
          </DialogTitle>
        </DialogHeader>

        {!isEditing && step === 0 && (
          <div className="grid grid-cols-4 gap-3">
            {WIDGET_TYPES.map((wt) => (
              <Button
                key={wt.type}
                variant={widgetType === wt.type ? 'default' : 'outline'}
                className="flex h-24 flex-col items-center justify-center gap-1"
                onClick={() => { setWidgetType(wt.type); setTitle(wt.label) }}
              >
                <span className="text-sm font-medium">{wt.label}</span>
                <span className="text-[10px] text-muted-foreground">{wt.desc}</span>
              </Button>
            ))}
            <div className="col-span-4 flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button disabled={!widgetType} onClick={() => { setStep(1); loadMeta() }}>Next</Button>
            </div>
          </div>
        )}

        {(step === 1 || isEditing) && (
          <div className="flex flex-col gap-4">
            {!isEditing && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setStep(0); setPreviewData(null) }}>
                  &larr; Change type
                </Button>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Query (JSON)</Label>
              <Textarea
                className="min-h-[120px] font-mono text-xs"
                value={queryText}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setQueryText(e.target.value)}
              />
            </div>

            {meta && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Available fields</summary>
                <div className="mt-1 max-h-32 overflow-y-auto space-y-0.5">
                  {meta.cubes.flatMap((c: CubeMeta['cubes'][number]) =>
                    [...c.measures, ...c.dimensions, ...c.timeDimensions].map((f) => (
                      <div key={f.name} className="flex gap-2">
                        <span className="font-medium">{f.name}</span>
                        <span className="text-[10px]">({f.type})</span>
                      </div>
                    )),
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-2">
              <Button variant="secondary" onClick={handlePreview} disabled={previewLoading}>
                {previewLoading ? 'Loading...' : 'Preview'}
              </Button>
            </div>

            {previewData && (
              <div className="max-h-40 overflow-auto rounded border text-xs">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted">
                      {Object.keys(previewData[0] || {}).map((k) => (
                        <th key={k} className="px-2 py-1 text-left font-medium">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, i) => (
                      <tr key={i} className="border-t">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-2 py-1">{String(v ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end gap-2">
              {!isEditing && <Button variant="outline" onClick={() => setStep(0)}>Back</Button>}
              <Button onClick={isEditing ? handleFinish : () => setStep(2)}>
                {isEditing ? 'Save' : 'Next'}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && !isEditing && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-4 gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">X</Label>
                <Input type="number" value={x} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setX(Number(e.target.value))} />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Y</Label>
                <Input type="number" value={y} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setY(Number(e.target.value))} />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Width</Label>
                <Input type="number" value={w} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setW(Number(e.target.value))} />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Height</Label>
                <Input type="number" value={h} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setH(Number(e.target.value))} />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={handleFinish}>Add Widget</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
