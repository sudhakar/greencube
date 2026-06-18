import Form from '@rjsf/shadcn'
import validator from '@rjsf/validator-ajv8'
import type { LucideIcon } from 'lucide-react'
import {
  Calculator,
  Calendar,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Columns2,
  Hash,
  Sigma,
  Text,
  ToggleLeft,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CompactAddButton, CompactArrayItemTemplate, FieldSelect } from '@/components/widget-config'
import { useReports } from '@/context/ReportContext'
import { executeQuery, fetchMeta } from '@/lib/api'
import { addWidget, updateWidget } from '@/lib/storage'
import type { Cube, CubeMeta, WidgetInstance, WidgetType } from '@/lib/types'
import { WIDGET_SCHEMAS } from '@/lib/widget-schemas'

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  measure: Calculator,
  dimension: Columns2,
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  count: Sigma, sum: Sigma, avg: Sigma, min: Sigma, max: Sigma,
  number: Hash, string: Text, time: Calendar, boolean: ToggleLeft,
}

function getCatIcon(field: { name: string }, cube: Cube): LucideIcon {
  if (cube.measures.some((m) => m.name === field.name)) return CATEGORY_ICONS.measure
  return CATEGORY_ICONS.dimension
}

function getTypeIcon(type: string): LucideIcon {
  return TYPE_ICONS[type] ?? CircleDot
}

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

  const [widgetType, setWidgetType] = useState<WidgetType>('bar')
  const [title, setTitle] = useState('Bar Chart')
  const [queryText, setQueryText] = useState(DEFAULT_QUERY)
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [meta, setMeta] = useState<CubeMeta | null>(null)
  const [previewData, setPreviewData] = useState<Record<string, unknown>[] | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [collapsedCubes, setCollapsedCubes] = useState<Record<string, boolean>>({})
  const [x, setX] = useState(0)
  const [y, setY] = useState(0)
  const [w, setW] = useState(24)
  const [h, setH] = useState(16)

  useEffect(() => {
    if (editingWidget) {
      setWidgetType(editingWidget.type)
      setTitle(editingWidget.title)
      setQueryText(JSON.stringify(editingWidget.query, null, 2))
      setConfig(editingWidget.config as Record<string, unknown>)
    }
  }, [editingWidget])

  useEffect(() => {
    if (open && !meta) {
      fetchMeta().then(setMeta).catch(() => { })
    }
  }, [open, meta])

  const handleClose = (open: boolean) => {
    onOpenChange(open)
    if (!open) {
      setWidgetType('bar')
      setTitle('Bar Chart')
      setQueryText(DEFAULT_QUERY)
      setConfig({})
      setPreviewData(null)
      setX(0); setY(0); setW(4); setH(3)
    }
  }

  const runPreview = async (query: object) => {
    try {
      setPreviewLoading(true)
      const result = await executeQuery(query)
      setPreviewData(result.data)
    } catch {
      setPreviewData([])
    } finally {
      setPreviewLoading(false)
    }
  }

  const handlePreview = () => {
    try { runPreview(JSON.parse(queryText)) } catch { setPreviewData([]) }
  }

  const isFieldSelected = (fieldName: string): boolean => {
    try {
      const q = JSON.parse(queryText)
      return !!(q.measures?.includes(fieldName) ||
        q.dimensions?.includes(fieldName) ||
        q.timeDimensions?.some((td: { dimension: string }) => td.dimension === fieldName))
    } catch { return false }
  }

  const toggleField = (fieldName: string) => {
    try {
      const q = JSON.parse(queryText)
      const isMeasure = meta?.cubes.some((c) => c.measures.some((m) => m.name === fieldName))
      const isTimeDim = meta?.cubes.some((c) => c.timeDimensions.some((td) => td.name === fieldName))

      if (isMeasure) {
        const idx = q.measures.indexOf(fieldName)
        if (idx >= 0) q.measures.splice(idx, 1)
        else q.measures.push(fieldName)
      } else if (isTimeDim) {
        const idx = q.timeDimensions.findIndex((td: { dimension: string }) => td.dimension === fieldName)
        if (idx >= 0) q.timeDimensions.splice(idx, 1)
        else q.timeDimensions.push({ dimension: fieldName, granularity: 'day' })
      } else {
        const idx = q.dimensions.indexOf(fieldName)
        if (idx >= 0) q.dimensions.splice(idx, 1)
        else q.dimensions.push(fieldName)
      }

      setQueryText(JSON.stringify(q, null, 2))
      runPreview(q)
    } catch { /* ignore parse errors */ }
  }

  const cubeState = useMemo(() => {
    if (!meta) return {}
    const state: Record<string, 'none' | 'some' | 'all'> = {}
    for (const cube of meta.cubes) {
      const allFields = [...cube.measures, ...cube.dimensions, ...cube.timeDimensions]
      const n = allFields.filter((f) => isFieldSelected(f.name)).length
      state[cube.name] = n === 0 ? 'none' : n === allFields.length ? 'all' : 'some'
    }
    return state
  }, [meta, queryText])

  const toggleCube = (cubeName: string) => {
    const cube = meta?.cubes.find((c) => c.name === cubeName)
    if (!cube) return
    const allFields = [
      ...cube.measures.map((f) => ({ name: f.name, kind: 'measure' as const })),
      ...cube.dimensions.map((f) => ({ name: f.name, kind: 'dimension' as const })),
      ...cube.timeDimensions.map((f) => ({ name: f.name, kind: 'timeDimension' as const })),
    ]
    try {
      const q = JSON.parse(queryText)
      const allSelected = allFields.every((f) => isFieldSelected(f.name))
      for (const f of allFields) {
        const selected = isFieldSelected(f.name)
        if (allSelected && selected) {
          if (f.kind === 'measure') {
            const idx = q.measures.indexOf(f.name)
            if (idx >= 0) q.measures.splice(idx, 1)
          } else if (f.kind === 'timeDimension') {
            const idx = q.timeDimensions.findIndex((td: { dimension: string }) => td.dimension === f.name)
            if (idx >= 0) q.timeDimensions.splice(idx, 1)
          } else {
            const idx = q.dimensions.indexOf(f.name)
            if (idx >= 0) q.dimensions.splice(idx, 1)
          }
        } else if (!allSelected && !selected) {
          if (f.kind === 'measure') q.measures.push(f.name)
          else if (f.kind === 'timeDimension') q.timeDimensions.push({ dimension: f.name, granularity: 'day' })
          else q.dimensions.push(f.name)
        }
      }
      setQueryText(JSON.stringify(q, null, 2))
      runPreview(q)
    } catch { /* ignore parse errors */ }
  }

  const handleFinish = () => {
    if (!widgetType || !activeId) return
    const query = JSON.parse(queryText)

    if (isEditing && editingWidget) {
      updateWidget(activeId, editingWidget.id, {
        title: title || widgetType,
        type: widgetType,
        query,
        config,
      })
    } else {
      addWidget(activeId, widgetType, title || widgetType, query, config, { x, y, w, h })
    }
    refresh()
    handleClose(false)
  }

  const availableFields = useMemo(() => {
    try {
      const q = JSON.parse(queryText)
      return [
        ...(q.measures || []),
        ...(q.dimensions || []),
        ...(q.timeDimensions?.map((td: { dimension: string }) => td.dimension) || []),
      ]
    } catch {
      return []
    }
  }, [queryText])

  const singleAxis = new Set(['valueField', 'trendField', 'xField', 'labelField'])
  const arrayAxis = new Set(['yFields'])

  const uiSchema = useMemo(() => {
    const schema = WIDGET_SCHEMAS[widgetType]
    if (!schema?.properties) return {}
    const ui: Record<string, unknown> = {}
    for (const key of Object.keys(schema.properties)) {
      if (singleAxis.has(key)) {
        ui[key] = { 'ui:widget': 'fieldSelect', 'ui:options': { fields: availableFields } }
      }
      if (arrayAxis.has(key)) {
        ui[key] = { items: { 'ui:widget': 'fieldSelect', 'ui:options': { fields: availableFields } } }
      }
    }
    return ui
  }, [widgetType, availableFields])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex flex-col gap-0" style={{ minWidth: '80vw', maxHeight: '80vh' }}>
        <DialogHeader className="shrink-0 mb-4">
          <DialogTitle>{isEditing ? 'Edit Widget' : 'Add Widget'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden overflow-y-auto">
          {!isEditing && (
            <div className="flex flex-row gap-2 flex-wrap justify-center">
              {WIDGET_TYPES.map((wt) => (
                <Button
                  key={wt.type}
                  variant={widgetType === wt.type ? 'default' : 'outline'}
                  size="sm"
                  className="flex flex-col items-center justify-center gap-0.5 h-14 w-[120px] px-2"
                  onClick={() => { setWidgetType(wt.type); setTitle(wt.label) }}
                >
                  <span className="text-xs font-medium">{wt.label}</span>
                  <span className="text-[9px] text-muted-foreground leading-tight text-wrap">{wt.desc}</span>
                </Button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-[50%_50%] gap-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Title</Label>
                <Input value={title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)} />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Query (JSON)</Label>
                <Textarea
                  className="min-h-[120px] font-mono text-xs"
                  value={queryText}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setQueryText(e.target.value)}
                />
              </div>

              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={handlePreview} disabled={previewLoading}>
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
            </div>

            <div className="flex flex-col gap-3 min-h-0">
              {!isEditing && (
                <div>
                  <Label className="text-xs mb-1.5 block">Layout</Label>
                  <div className="grid grid-cols-4 gap-1">
                    <div className="flex flex-row items-center gap-1">
                      <Label className="text-[10px] shrink-0">X</Label>
                      <Input type="number" value={x} className='w-14' onChange={(e: React.ChangeEvent<HTMLInputElement>) => setX(Number(e.target.value))} />
                    </div>
                    <div className="flex flex-row items-center gap-1">
                      <Label className="text-[10px] shrink-0">Y</Label>
                      <Input type="number" value={y} className='w-14' onChange={(e: React.ChangeEvent<HTMLInputElement>) => setY(Number(e.target.value))} />
                    </div>
                    <div className="flex flex-row items-center gap-1">
                      <Label className="text-[10px] shrink-0">W</Label>
                      <Input type="number" value={w} className='w-14' onChange={(e: React.ChangeEvent<HTMLInputElement>) => setW(Number(e.target.value))} />
                    </div>
                    <div className="flex flex-row items-center gap-1">
                      <Label className="text-[10px] shrink-0">H</Label>
                      <Input type="number" value={h} className='w-14' onChange={(e: React.ChangeEvent<HTMLInputElement>) => setH(Number(e.target.value))} />
                    </div>
                  </div>
                </div>
              )}

              {meta && (
                <div className="flex flex-col gap-2">
                  <Label className="text-xs">Available Fields</Label>
                  {(() => {
                    const cubes = meta.cubes
                    const mid = Math.ceil(cubes.length / 2)
                    const renderCube = (cube: Cube) => {
                      const cs = cubeState[cube.name] ?? 'none'
                      const allFields = [...cube.measures, ...cube.dimensions, ...cube.timeDimensions]
                      const total = allFields.length
                      const selected = allFields.filter((f) => isFieldSelected(f.name)).length
                      const collapsed = collapsedCubes[cube.name] ?? true
                      return (
                        <div key={cube.name} className="rounded border overflow-hidden">
                          <table className="w-full">
                            <thead>
                              <tr
                                className="bg-muted/50 cursor-pointer select-none"
                                onClick={() => setCollapsedCubes((prev) => ({ ...prev, [cube.name]: !collapsed }))}
                              >
                                <td className="w-4 px-1 pt-0.5">
                                  <Checkbox
                                    size="xs"
                                    checked={cs === 'all' ? true : cs === 'some' ? 'indeterminate' : false}
                                    onClick={(e) => e.stopPropagation()}
                                    onCheckedChange={() => toggleCube(cube.name)}
                                  />
                                </td>
                                <td className="px-0 py-1 text-[10px] font-semibold">
                                  <div className="flex items-center gap-1.5">
                                    <span>{cube.name}</span>
                                    <span className="text-[9px] text-muted-foreground">({selected}/{total})</span>
                                    <button
                                      type="button"
                                      className="ml-auto outline-none"
                                      onClick={(e) => { e.stopPropagation(); setCollapsedCubes((prev) => ({ ...prev, [cube.name]: !collapsed })) }}
                                    >
                                      {collapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
                                    </button>
                                  </div>
                                </td>
                                <td className="w-30 px-2 py-1" />
                              </tr>
                            </thead>
                            {!collapsed && (
                              <tbody>
                                {allFields.sort((a, b) => a.name.localeCompare(b.name)).map((f) => {
                                  const CatIcon = getCatIcon(f, cube)
                                  const TypeIcon = getTypeIcon(f.type)
                                  const shortName = f.name.startsWith(cube.name + '.') ? f.name.slice(cube.name.length + 1) : f.name
                                  return (
                                    <tr key={f.name} className="border-t">
                                      <td className="w-4 px-1 pt-0.5">
                                        <Checkbox
                                          size="xs"
                                          checked={isFieldSelected(f.name)}
                                          onCheckedChange={() => toggleField(f.name)}
                                        />
                                      </td>
                                      <td className="px-0 py-1 font-mono text-[10px]">
                                        <CatIcon className="mr-1 inline size-3 align-text-bottom text-muted-foreground" />
                                        {shortName}
                                      </td>
                                      <td className="w-30 px-2 py-1 text-[9px] text-muted-foreground">
                                        <TypeIcon className="mr-1 inline size-3 align-text-bottom text-muted-foreground" />
                                        {f.type}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            )}
                          </table>
                        </div>
                      )
                    }
                    return (
                      <div className="flex gap-2">
                        <div className="flex flex-1 flex-col gap-2">{cubes.slice(0, mid).map(renderCube)}</div>
                        <div className="flex flex-1 flex-col gap-2">{cubes.slice(mid).map(renderCube)}</div>
                      </div>
                    )
                  })()}
                </div>
              )}

              {widgetType && (
                <div className="border-t pt-2">
                  <Label className="text-xs mb-1 block">Widget Config</Label>
                  <div className="max-h-48 overflow-auto">
                    <Form
                      schema={WIDGET_SCHEMAS[widgetType]}
                      formData={config}
                      validator={validator}
                      uiSchema={uiSchema}
                      widgets={{ fieldSelect: FieldSelect }}
                      templates={{ ArrayFieldItemTemplate: CompactArrayItemTemplate, ButtonTemplates: { AddButton: CompactAddButton } }}
                      onChange={(e) => setConfig(e.formData)}
                    >
                      <></>
                    </Form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t shrink-0">
          <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
          <Button onClick={handleFinish} disabled={!widgetType}>
            {isEditing ? 'Save' : 'Add Widget'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
