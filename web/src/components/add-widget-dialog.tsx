import Form from '@rjsf/shadcn'
import validator from '@rjsf/validator-ajv8'
import type { LucideIcon } from 'lucide-react'
import {
  BracesIcon,
  Calculator,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Columns2,
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
import { InputGroup, InputGroupButton, InputGroupTextarea } from '@/components/ui/input-group'
import { Toggle } from '@/components/ui/toggle'
import { CompactAddButton, CompactArrayFieldTemplate, CompactArrayFieldTitleTemplate, CompactArrayItemTemplate, CompactObjectFieldTemplate, FieldSelect, FlatFormatList, FormatSelect, MultiFieldSelect, PrefixSelect, TitleWidget, XsBaseInputTemplate } from '@/components/widget-config'
import { useReports } from '@/context/ReportContext'
import { useFetch } from '@/hooks/useFetch'
import { cube } from '@/lib/cube/cube'
import type { Query } from '@/lib/cube/types'
import { fieldType } from '@/lib/meta'
import { addWidget, updateWidget } from '@/lib/storage'
import type { Cube, CubeMeta, WidgetInstance, WidgetType } from '@/lib/types'
import { WIDGET_SCHEMAS } from '@/lib/widget-schemas'
import { AreaWidget } from '@/widgets/AreaWidget'
import { BarWidget } from '@/widgets/BarWidget'
import { LineWidget } from '@/widgets/LineWidget'
import { NumberWidget } from '@/widgets/NumberWidget'
import { PieWidget } from '@/widgets/PieWidget'
import { TableWidget } from '@/widgets/TableWidget'

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  measure: Calculator,
  dimension: Columns2,
  timeDimension: CalendarDays,
}

function getCatIcon(field: { name: string }, cube: Cube): LucideIcon {
  if (cube.measures.some((m) => m.name === field.name)) return CATEGORY_ICONS.measure
  if (cube.timeDimensions.some((t) => t.name === field.name)) return CATEGORY_ICONS.timeDimension
  return CATEGORY_ICONS.dimension
}

const WIDGET_TYPES: { type: WidgetType; label: string; desc: string }[] = [
  { type: 'number', label: 'Number', desc: 'Single value with optional trend' },
  { type: 'bar', label: 'Bar Chart', desc: 'Categorical comparison' },
  { type: 'line', label: 'Line Chart', desc: 'Trend over time' },
  { type: 'area', label: 'Area Chart', desc: 'Filled trend' },
  { type: 'pie', label: 'Pie Chart', desc: 'Proportions' },
  { type: 'table', label: 'Table', desc: 'Tabular data' },
]

const DEFAULT_QUERY = JSON.stringify({ dimensions: [], timeDimensions: [], measures: [] }, null, 2)

interface AddWidgetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingWidget?: WidgetInstance | null
}

export function AddWidgetDialog({ open, onOpenChange, editingWidget }: AddWidgetDialogProps) {
  const { activeId, refresh } = useReports()
  const isEditing = !!editingWidget

  const [widgetType, setWidgetType] = useState<WidgetType>('bar')
  const [queryText, setQueryText] = useState(DEFAULT_QUERY)
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [meta, setMeta] = useState<CubeMeta | null>(null)
  const [committedQuery, setCommittedQuery] = useState<Query | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [collapsedCubes, setCollapsedCubes] = useState<Record<string, boolean>>({})
  const [step, setStep] = useState<'fields' | 'configure'>('fields')
  const [showQuery, setShowQuery] = useState(false)

  const { data: previewData, isLoading: previewLoading, error } = useFetch(committedQuery)
  const previewError = parseError ?? error

  useEffect(() => {
    if (editingWidget && open) {
      setWidgetType(editingWidget.type)
      setQueryText(JSON.stringify(editingWidget.query, null, 2))
      setConfig({ title: editingWidget.title, ...editingWidget.config as Record<string, unknown> })
      setCommittedQuery({ ...editingWidget.query, limit: 100 })
    }
  }, [editingWidget, open])

  useEffect(() => {
    if (open && !meta) {
      cube.meta().then(setMeta).catch(() => { })
    }
  }, [open, meta])

  useEffect(() => {
    if (open && meta && !isEditing && queryText === DEFAULT_QUERY) {
      const allDims = meta.cubes.flatMap(c => c.dimensions.map(d => d.name))
      const allTimeDims = meta.cubes.flatMap(c => c.timeDimensions.map(td => td.name))
      const allMeasures = meta.cubes.flatMap(c => c.measures.map(m => m.name))

      const selectedDims = [...allDims, ...allTimeDims].slice(0, 2)
      const selectedMeasures = allMeasures.slice(0, 1)

      if (selectedDims.length === 0 && selectedMeasures.length === 0) return

      const dims: string[] = []
      const timeDims: { dimension: string; granularity: string }[] = []

      for (const d of selectedDims) {
        const isTime = meta.cubes.some(c => c.timeDimensions.some(td => td.name === d))
        if (isTime) timeDims.push({ dimension: d, granularity: 'day' })
        else dims.push(d)
      }

      const query = { dimensions: dims, timeDimensions: timeDims, measures: selectedMeasures }
      setQueryText(JSON.stringify(query, null, 2))
      setCommittedQuery({ ...query, limit: 100 })
    }
  }, [open, meta, isEditing, queryText])

  const handleClose = (open: boolean) => {
    onOpenChange(open)
    if (!open) {
      setWidgetType('bar')
      setQueryText(DEFAULT_QUERY)
      setConfig({})
      setCommittedQuery(null)
      setParseError(null)
      setShowQuery(false)
      setStep('fields')
    }
  }

  const handlePreview = () => {
    try {
      setCommittedQuery({ ...JSON.parse(queryText), limit: 100 })
      setParseError(null)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : 'Invalid query')
    }
  }

  const deriveConfig = (widgetType: WidgetType): Record<string, unknown> => {
    try {
      const q = JSON.parse(queryText)
      const measures: string[] = q.measures ?? []
      const dimensions: string[] = q.dimensions ?? []
      const timeDims: string[] = (q.timeDimensions ?? []).map((td: { dimension: string }) => td.dimension)
      const firstMeasure = measures[0] ?? ''
      const firstDim = dimensions[0] ?? timeDims[0] ?? ''

      switch (widgetType) {
        case 'bar':
        case 'line':
        case 'area':
          return { title: 'Widget Title', xField: firstDim, yFields: measures }
        case 'pie':
          return { title: 'Widget Title', labelField: firstDim, valueField: firstMeasure }
        case 'number':
          return { title: 'Widget Title', valueField: firstMeasure }
        case 'table': {
          const allFields = [...measures, ...dimensions, ...timeDims]
          const numericTimeFields = allFields.filter((f) => {
            const t = fieldType(f)
            if (!t) return true
            return t !== 'string' && t !== 'boolean'
          })
          return {
            title: 'Widget Title',
            columnFormats: numericTimeFields.map((f) => ({
              field: f,
              prefix: '',
              format: 'none',
              precision: 0,
            })),
          }
        }
      }
    } catch {
      return {}
    }
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
      setCommittedQuery({ ...q, limit: 100 })
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
      setCommittedQuery({ ...q, limit: 100 })
    } catch { /* ignore parse errors */ }
  }

  const handleFinish = () => {
    if (!widgetType || !activeId) return
    const query = JSON.parse(queryText)
    const { title: rawTitle, ...configRest } = config
    const widgetTitle = ((rawTitle as string) ?? '').trim()

    if (isEditing && editingWidget) {
      updateWidget(activeId, editingWidget.id, {
        title: widgetTitle,
        type: widgetType,
        query,
        config: configRest,
      })
    } else {
      addWidget(activeId, widgetType, widgetTitle, query, configRest, { x: 0, y: 0, w: 24, h: 16 })
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

  const measureFields = useMemo(() => {
    try {
      const q = JSON.parse(queryText)
      return q.measures || []
    } catch {
      return []
    }
  }, [queryText])

  const singleAxis = new Set(['valueField', 'trendField', 'xField', 'labelField'])
  const multiAxis = new Set(['yFields'])
  const formatKeys = new Set(['xFormat', 'yFormat', 'valueFormat'])

  const uiSchema = useMemo(() => {
    const schema = WIDGET_SCHEMAS[widgetType]
    if (!schema?.properties) return {}
    const ui: Record<string, unknown> = {
      title: { 'ui:widget': 'titleWidget', 'ui:options': { label: false } },
    }
    for (const key of Object.keys(schema.properties)) {
      if (singleAxis.has(key)) {
        ui[key] = { 'ui:widget': 'fieldSelect', 'ui:options': { fields: availableFields } }
      }
      if (multiAxis.has(key)) {
        ui[key] = { 'ui:widget': 'multiFieldSelect', 'ui:options': { fields: measureFields } }
      }
      if (formatKeys.has(key)) {
        let ft = 'string'
        const cfg = config as Record<string, unknown>
        if (key === 'yFormat') ft = 'number'
        else if (key === 'xFormat') {
          const xf = cfg.xField as string
          const raw = fieldType(xf)
          if (raw === 'time') ft = 'time'
          else if (raw === 'string' || raw === 'boolean') ft = 'string'
          else ft = 'number'
        } else if (key === 'valueFormat') {
          const vf = cfg.valueField as string
          const raw = fieldType(vf)
          if (raw === 'time') ft = 'time'
          else if (raw === 'string' || raw === 'boolean') ft = 'string'
          else ft = 'number'
        }
        ui[key] = { 'ui:widget': 'formatSelect', 'ui:options': { fieldType: ft } }
      }
    }
    if (widgetType === 'table') {
      ui.columnFormats = { 'ui:field': 'flatFormatList' }
    }
    return ui
  }, [widgetType, availableFields, measureFields, config])

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex flex-col gap-0" style={{ minWidth: '1150px', height: '600px' }}>
        <DialogHeader className="shrink-0 mb-4">
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? 'Edit Widget' : step === 'fields' ? 'Add Widget' : 'Configure Widget'}
            {step === 'fields' && (
              <Toggle size="sm" variant="default" pressed={showQuery} onPressedChange={(p) => setShowQuery(p)} aria-label="Show/hide query" className="h-6 w-6">
                <BracesIcon className="size-4" />
              </Toggle>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-hidden pt-1">
          {step === 'fields' && (
            <div className="grid grid-cols-[7fr_3fr] gap-4 flex-1 min-h-0">
              <div className="flex flex-col gap-3 min-w-0 min-h-0">
                {showQuery && (
                  <InputGroup className="h-auto relative rounded-[min(var(--radius-md),8px)]">
                    <InputGroupTextarea className="min-h-50 max-h-50 font-mono md:text-[10px] pb-7 leading-tight" value={queryText} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setQueryText(e.target.value)} />
                    <InputGroupButton size="xs" variant="outline" onClick={handlePreview} disabled={previewLoading} className="absolute bottom-1 right-1 z-10 font-normal text-xs rounded-sm">
                      {previewLoading ? 'Loading...' : 'Preview'}
                    </InputGroupButton>
                  </InputGroup>
                )}

                <div className="flex-1 min-h-0 pb-3">
                  {previewError && (
                    <div className="h-full overflow-auto rounded border border-dashed text-xs p-4 text-center text-muted-foreground pt-12">
                      {previewError}
                    </div>
                  )}
                  {!previewError && previewData && previewData.length > 0 && (
                    <div className="h-full overflow-auto rounded border text-xs">
                      <table className="w-full">
                        <thead>
                          <tr>
                            {Object.keys(previewData[0] || {}).map((k) => (
                              <th key={k} className="sticky top-0 z-10 bg-muted px-2 py-1 text-left font-medium">{k}</th>
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
                  {!previewError && !previewLoading && previewData.length === 0 && (
                    <div className="h-full overflow-auto rounded border border-dashed text-xs p-4 text-center text-muted-foreground pt-12">
                      No data. Run a query to see results.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-3 min-w-0 min-h-0 overflow-y-auto">
                {meta && (
                  <div className="flex flex-col gap-2">
                    {meta.cubes.map((cube: Cube) => {
                      const cs = cubeState[cube.name] ?? 'none'
                      const measuresSorted = [...cube.measures].sort((a, b) => a.name.localeCompare(b.name))
                      const dimensionsSorted = [...cube.dimensions].sort((a, b) => a.name.localeCompare(b.name))
                      const timeDimensionsSorted = [...cube.timeDimensions].sort((a, b) => a.name.localeCompare(b.name))
                      const allFields = [...cube.measures, ...cube.dimensions, ...cube.timeDimensions]
                      const total = allFields.length
                      const selected = allFields.filter((f) => isFieldSelected(f.name)).length
                      const collapsed = collapsedCubes[cube.name] ?? true
                      return (
                        <div key={cube.name} className="rounded border border-muted">
                          <table className="w-full">
                            <thead>
                              <tr
                                className="sticky top-0 z-10 cursor-pointer select-none"
                                onClick={() => setCollapsedCubes((prev) => ({ ...prev, [cube.name]: !collapsed }))}
                              >
                                <td className="w-4 px-1 pt-0.5 bg-muted">
                                  <Checkbox
                                    checked={cs === 'all'}
                                    indeterminate={cs === 'some'}
                                    onClick={(e) => e.stopPropagation()}
                                    onCheckedChange={() => toggleCube(cube.name)}
                                  />
                                </td>
                                <td colSpan={2} className="flex-1 px-0 py-1 text-[10px] font-semibold bg-muted">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <span>{cube.name}</span>
                                    </div>
                                    <div className='flex'>
                                      <span className="text-[9px] text-muted-foreground">({selected}/{total})</span>

                                      <button
                                        type="button"
                                        className="flex items-center justify-center px-1 outline-none"
                                        onClick={(e) => { e.stopPropagation(); setCollapsedCubes((prev) => ({ ...prev, [cube.name]: !collapsed })) }}
                                      >
                                        {collapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            </thead>
                            {!collapsed && (
                              <tbody>
                                {dimensionsSorted.length > 0 && (
                                  <>
                                    <tr className="sticky top-[22px] z-10 border-t border-muted bg-popover">
                                      <td colSpan={3} className="px-2 py-0.5 text-[9px] text-muted-foreground uppercase tracking-wider text-center">Dimensions</td>
                                    </tr>
                                    {dimensionsSorted.map((f) => {
                                      const CatIcon = getCatIcon(f, cube)
                                      const shortName = f.name.startsWith(cube.name + '.') ? f.name.slice(cube.name.length + 1) : f.name
                                      return (
                                        <tr key={f.name} className="cursor-pointer border-t border-muted hover:bg-muted/20" onClick={() => toggleField(f.name)}>
                                          <td className="w-4 px-1 pt-0.5">
                                            <Checkbox checked={isFieldSelected(f.name)} onClick={(e) => e.stopPropagation()} onCheckedChange={() => toggleField(f.name)} />
                                          </td>
                                          <td className="px-0 py-1 text-[10px]">
                                            <CatIcon className="mr-1 inline size-3 align-text-bottom text-muted-foreground" />
                                            {shortName}
                                          </td>
                                          <td className="w-20 truncate px-2 py-1 text-[10px] text-muted-foreground">{f.type}</td>
                                        </tr>
                                      )
                                    })}
                                  </>
                                )}
                                {timeDimensionsSorted.length > 0 && (
                                  <>
                                    <tr className="sticky top-[22px] z-10 border-t border-muted bg-popover">
                                      <td colSpan={3} className="px-2 py-0.5 text-[9px] text-muted-foreground uppercase tracking-wider text-center">Time Dimensions</td>
                                    </tr>
                                    {timeDimensionsSorted.map((f) => {
                                      const CatIcon = getCatIcon(f, cube)
                                      const shortName = f.name.startsWith(cube.name + '.') ? f.name.slice(cube.name.length + 1) : f.name
                                      return (
                                        <tr key={f.name} className="cursor-pointer border-t border-muted hover:bg-muted/20" onClick={() => toggleField(f.name)}>
                                          <td className="w-4 px-1 pt-0.5">
                                            <Checkbox checked={isFieldSelected(f.name)} onClick={(e) => e.stopPropagation()} onCheckedChange={() => toggleField(f.name)} />
                                          </td>
                                          <td className="px-0 py-1 text-[10px]">
                                            <CatIcon className="mr-1 inline size-3 align-text-bottom text-muted-foreground" />
                                            {shortName}
                                          </td>
                                          <td className="w-20 truncate px-2 py-1 text-[10px] text-muted-foreground">{f.type}</td>
                                        </tr>
                                      )
                                    })}
                                  </>
                                )}
                                {measuresSorted.length > 0 && (
                                  <>
                                    <tr className="sticky top-[22px] z-10 border-t border-muted bg-popover">
                                      <td colSpan={3} className="px-2 py-0.5 text-[9px] text-muted-foreground uppercase tracking-wider text-center">Measures</td>
                                    </tr>
                                    {measuresSorted.map((f) => {
                                      const CatIcon = getCatIcon(f, cube)
                                      const shortName = f.name.startsWith(cube.name + '.') ? f.name.slice(cube.name.length + 1) : f.name
                                      return (
                                        <tr key={f.name} className="cursor-pointer border-t border-muted hover:bg-muted/20" onClick={() => toggleField(f.name)}>
                                          <td className="w-4 px-1 pt-0.5">
                                            <Checkbox checked={isFieldSelected(f.name)} onClick={(e) => e.stopPropagation()} onCheckedChange={() => toggleField(f.name)} />
                                          </td>
                                          <td className="px-0 py-1 text-[10px]">
                                            <CatIcon className="mr-1 inline size-3 align-text-bottom text-muted-foreground" />
                                            {shortName}
                                          </td>
                                          <td className="w-20 truncate px-2 py-1 text-[10px] text-muted-foreground">{f.type}</td>
                                        </tr>
                                      )
                                    })}
                                  </>
                                )}
                              </tbody>
                            )}
                          </table>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'configure' && (
            <div className="grid grid-cols-[7fr_3fr] grid-rows-1 gap-4 flex-1 min-h-0">
              <div className="flex flex-row gap-3 min-w-0 min-h-0 overflow-y-auto">
                <div className="flex flex-col gap-2 shrink-0">
                  {WIDGET_TYPES.map((wt) => (
                    <Button
                      key={wt.type}
                      variant={widgetType === wt.type ? 'default' : 'outline'}
                      size="sm"
                      className="flex flex-col justify-start h-14 w-[100px] px-2 py-2 gap-0"
                      onClick={() => { setWidgetType(wt.type); setConfig(deriveConfig(wt.type)) }}
                    >
                      <span className="text-xs font-medium">{wt.label}</span>
                      <span className="text-[9px] text-muted-foreground leading-tight text-wrap">{wt.desc}</span>
                    </Button>
                  ))}
                </div>
                {previewData && previewData.length > 0 ? (
                  <div className="flex-1 overflow-auto rounded border min-h-0 p-8"
                    style={{ background: "linear-gradient(90deg, #18181b 1px, transparent 1px) 0 0 / 5px 5px,   linear-gradient(#18181b 1px, transparent 1px) 0 0 / 5px 5px,   hsl(240 6% 4% / 1)" }}
                  >
                    <div className="flex h-full flex-col overflow-hidden rounded-sm bg-card">
                      <div className="px-3 pt-1.5 pb-1.5">
                        <span className="truncate text-sm font-medium">{((config.title as string) ?? '').trim() || 'Widget Title'}</span>
                      </div>
                      <div className="flex-1 overflow-auto p-0 relative">
                        {widgetType === 'number' && <NumberWidget data={previewData} config={config as never} />}
                        {widgetType === 'bar' && <BarWidget data={previewData} config={config as never} />}
                        {widgetType === 'line' && <LineWidget data={previewData} config={config as never} />}
                        {widgetType === 'area' && <AreaWidget data={previewData} config={config as never} />}
                        {widgetType === 'pie' && <PieWidget data={previewData} config={config as never} />}
                        {widgetType === 'table' && <TableWidget data={previewData} config={config as never} />}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground min-h-0">
                    No data. Go back and configure your query.
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-3 min-w-0 min-h-0 overflow-y-auto">
                {widgetType && (
                  <div className=''>
                    <Form
                      schema={WIDGET_SCHEMAS[widgetType]}
                      formData={config}
                      validator={validator}
                      uiSchema={uiSchema}
                      formContext={config}
                      fields={{ flatFormatList: FlatFormatList as never }}
                      widgets={{ fieldSelect: FieldSelect, multiFieldSelect: MultiFieldSelect, formatSelect: FormatSelect, prefixSelect: PrefixSelect, titleWidget: TitleWidget }}
                      templates={{ ArrayFieldTemplate: CompactArrayFieldTemplate, ArrayFieldItemTemplate: CompactArrayItemTemplate, ArrayFieldTitleTemplate: CompactArrayFieldTitleTemplate, ObjectFieldTemplate: CompactObjectFieldTemplate as never, BaseInputTemplate: XsBaseInputTemplate, ButtonTemplates: { AddButton: CompactAddButton } }}
                      onChange={(e) => setConfig(e.formData)}
                      className="widget-config-xs"
                    >
                      <></>
                    </Form>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t shrink-0 mt-4">
          {step === 'fields' ? (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button onClick={() => { setConfig(deriveConfig(widgetType)); setStep('configure'); handlePreview() }}>
                Next
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
              <Button variant="outline" onClick={() => setStep('fields')}>Back</Button>
              <Button onClick={handleFinish} disabled={!widgetType}>
                {isEditing ? 'Save' : 'Add Widget'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
