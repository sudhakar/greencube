import { Plus, X } from 'lucide-react'
import type { ComponentProps, ComponentType, MouseEventHandler, ReactNode, ReactElement } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { fieldType } from '@/lib/meta'

export const FieldSelect: ComponentType<any> = ({ value, onChange, options }) => {
  const fields = options?.fields ?? []
  const short = (f: string) => { const d = f.indexOf('.'); return d >= 0 ? f.slice(d + 1) : f }
  const displayValue = value ? short(value) : ''
  return (
    <Select value={value || ''} onValueChange={(v) => onChange(v)}>
      <SelectTrigger size="sm" className="h-6 text-xs py-0">
        <span className="text-xs truncate">{displayValue || 'Select field'}</span>
      </SelectTrigger>
      <SelectContent>
        {fields.map((f: string) => (
          <SelectItem key={f} value={f} className="text-xs">
            {short(f)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export const MultiFieldSelect: ComponentType<any> = ({ value = [], onChange, options }) => {
  const fields = options?.fields ?? []
  return (
    <div className="flex flex-col gap-0.5">
      {fields.map((f: string) => {
        const checked = value.includes(f)
        return (
          <label key={f} className="flex items-center gap-1.5 cursor-pointer py-0.5 px-1 text-xs hover:bg-muted/50 rounded-sm">
            <Checkbox size="xs" checked={checked} onCheckedChange={() => {
              if (checked) onChange(value.filter((v: string) => v !== f))
              else onChange([...value, f])
            }} />
            <span>{f}</span>
          </label>
        )
      })}
    </div>
  )
}

const FORMAT_OPTIONS: Record<string, { value: string; label: string }[]> = {
  number: [
    { value: 'none', label: 'raw' },
    { value: 'comma', label: 'comma' },
    { value: 'compact', label: 'short' },
  ],
  time: [
    { value: 'date-M/D', label: '4/25' },
    { value: 'date-M/D/YYYY', label: '4/25/2026' },
    { value: 'date-MMM-D', label: 'Apr 25' },
    { value: 'date-MMM-D-YYYY', label: 'Apr 25, 2026' },
    { value: 'date-YYYY-MM-DD', label: '2026-04-25' },
  ],
  string: [
    { value: 'none', label: 'Raw' },
  ],
  all: [
    { value: 'none', label: 'raw' },
    { value: 'comma', label: 'comma' },
    { value: 'compact', label: 'short' },
    { value: 'date-M/D', label: '4/25' },
    { value: 'date-M/D/YYYY', label: '4/25/2026' },
    { value: 'date-MMM-D', label: 'Apr 25' },
    { value: 'date-MMM-D-YYYY', label: 'Apr 25, 2026' },
    { value: 'date-YYYY-MM-DD', label: '2026-04-25' },
  ],
}

export const FormatSelect: ComponentType<any> = ({ value, onChange, options, id, registry }) => {
  let ft: string = options?.fieldType ?? ''
  if (!ft && id && registry?.formContext?.columnFormats) {
    const match = id.match(/columnFormats_(\d+)_format/)
    if (match) {
      const idx = parseInt(match[1])
      const items = registry.formContext.columnFormats as Array<{ field?: string }>
      const itemField = items?.[idx]?.field
      const raw = itemField ? fieldType(itemField) : undefined
      if (raw === 'time') ft = 'time'
      else if (raw === 'string' || raw === 'boolean') ft = 'string'
      else ft = 'number'
    }
  }
  if (!ft) ft = 'string'
  const opts = FORMAT_OPTIONS[ft] ?? FORMAT_OPTIONS.string
  const safeValue = value === 'auto' ? 'none' : (value ?? '')
  const displayLabel = opts.find((o) => o.value === safeValue)?.label ?? safeValue
  return (
    <Select value={safeValue} onValueChange={(v) => onChange(v)}>
      <SelectTrigger size="sm" className="h-6 text-xs py-0">
        <span className="text-xs truncate">{displayLabel}</span>
      </SelectTrigger>
      <SelectContent>
        {opts.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const PREFIX_OPTIONS = [
  { value: '', label: '—' },
  { value: '$', label: '$' },
  { value: '€', label: '€' },
  { value: '£', label: '£' },
  { value: '¥', label: '¥' },
]

export const PrefixSelect: ComponentType<any> = ({ value, onChange }) => {
  const displayLabel = PREFIX_OPTIONS.find((o) => o.value === (value ?? ''))?.label ?? value ?? '—'
  return (
    <Select value={value ?? ''} onValueChange={(v) => onChange(v)}>
      <SelectTrigger size="sm" className="h-6 text-xs py-0 w-12">
        <span className="text-xs">{displayLabel}</span>
      </SelectTrigger>
      <SelectContent>
        {PREFIX_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-xs">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function XsBaseInputTemplate(props: ComponentProps<any>) {
  const { id, htmlName, placeholder, required, readonly, disabled, type, value, onChange, onBlur, onFocus, autofocus, rawErrors, className } = props
  return (
    <div className="p-0">
      <input
        data-slot="input"
        id={id}
        name={htmlName || id}
        type={type}
        placeholder={placeholder}
        autoFocus={autofocus}
        required={required}
        disabled={disabled}
        readOnly={readonly}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? props.options?.emptyValue ?? '' : e.target.value)}
        onBlur={(e) => onBlur?.(id, e.target.value)}
        onFocus={(e) => onFocus?.(id, e.target.value)}
        className={`border-input flex h-6 w-full min-w-0 rounded-sm border bg-transparent px-1.5 py-0.5 text-[10px] shadow-xs file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50${rawErrors?.length ? ' border-destructive focus-visible:ring-0' : ''}${className ? ` ${className}` : ''}`}
      />
    </div>
  )
}

export function TitleWidget({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <InputGroup>
      <InputGroupAddon className="pl-1.5 text-muted-foreground text-[10px]">
        Title
      </InputGroupAddon>
      <InputGroupInput value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    </InputGroup>
  )
}

export function CompactArrayFieldTitleTemplate({ title }: { title?: string }) {
  if (!title) return null
  return <div className="text-[10px] font-medium text-muted-foreground mb-1">{title}</div>
}

export function CompactArrayFieldTemplate({ title, items, canAdd, onAddClick, disabled, readonly }: {
  title?: string
  items?: ReactElement[]
  canAdd?: boolean
  onAddClick?: () => void
  disabled?: boolean
  readonly?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      {title && <CompactArrayFieldTitleTemplate title={title} />}
      {items}
      {canAdd && (
        <CompactAddButton onClick={onAddClick} disabled={disabled || readonly} />
      )}
    </div>
  )
}

export function CompactArrayItemTemplate({ children, hasToolbar, buttonsProps }: { children: ReactNode; hasToolbar?: boolean; buttonsProps?: { onRemoveItem?: () => void } }) {
  return (
    <div className="flex items-stretch gap-1 mb-1">
      <div className="flex-1">{children}</div>
      {hasToolbar && buttonsProps?.onRemoveItem && (
        <InputGroupButton size="icon-xs" variant="ghost" onClick={buttonsProps.onRemoveItem}>
          <X className="size-3" />
        </InputGroupButton>
      )}
    </div>
  )
}

export function CompactObjectFieldTemplate({ properties, uiSchema, formData }: { properties?: { content: ReactNode; name: string; hidden: boolean }[]; uiSchema?: Record<string, unknown>; formData?: { field?: string } }) {
  const rowLayout = (uiSchema?.['ui:options'] as Record<string, unknown>)?.objectLayout === 'row'
  const isTime = formData?.field ? fieldType(formData.field) === 'time' : false
  const visible = properties?.filter((e) => !e.hidden && (!isTime || (e.name !== 'prefix' && e.name !== 'precision'))) ?? []
  if (rowLayout) {
    return (
      <div className="flex gap-1">
        {visible.map((element) => (
          <div key={element.name} className="flex-1">
            {element.content}
          </div>
        ))}
      </div>
    )
  }
  return (
    <>
      {visible.map((element) => (
        <div key={element.name}>{element.content}</div>
      ))}
    </>
  )
}

export function CompactAddButton({ onClick, disabled }: { onClick?: MouseEventHandler<HTMLButtonElement>; disabled?: boolean }) {
  return (
    <InputGroupButton size="xs" variant="outline" onClick={onClick} disabled={disabled} className="w-fit gap-1 text-xs">
      <Plus className="size-3" /> Add
    </InputGroupButton>
  )
}

const FIELD_PREFIX_OPTIONS = [
  { value: '', label: '—' },
  { value: '$', label: '$' },
  { value: '€', label: '€' },
  { value: '£', label: '£' },
  { value: '¥', label: '¥' },
]

function shortField(f: string) {
  const d = f.indexOf('.')
  return d >= 0 ? f.slice(d + 1) : f
}

export function FlatFormatList({ formData, onChange, fieldPathId }: { formData?: Array<Record<string, unknown>>; onChange: (...args: any[]) => void; fieldPathId?: { path: (string | number)[] } }) {
  const items = formData ?? []
  const setRow = (idx: number, updates: Record<string, unknown>) => {
    const next = items.map((item, i) => (i === idx ? { ...item, ...updates } : item))
    onChange(next, fieldPathId?.path)
  }
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-[10px] font-medium text-muted-foreground mb-0.5">Format Column</div>
      {items.map((item, idx) => {
        const fieldName = item.field as string
        const ft = fieldType(fieldName)
        const isTime = ft === 'time'
        const isStringy = ft === 'string' || ft === 'boolean'
        const formatType = isTime ? 'time' : (isStringy ? 'string' : 'number')
        const fmtOpts = FORMAT_OPTIONS[formatType]
        return (
          <div key={fieldName} className="flex gap-1 items-center">
            <div className="flex-1 truncate text-xs h-6 flex items-center px-1.5 border rounded-sm bg-muted/20">
              {shortField(fieldName)}
            </div>
            {!isTime && (
              <Select value={(item.prefix as string) ?? ''} onValueChange={(v) => setRow(idx, { prefix: v })}>
                <SelectTrigger size="sm" className="h-6 text-xs py-0 w-12">
                  <span className="text-xs">
                    {FIELD_PREFIX_OPTIONS.find((o) => o.value === ((item.prefix as string) ?? ''))?.label ?? '—'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {FIELD_PREFIX_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={(item.format as string) ?? 'none'} onValueChange={(v) => setRow(idx, { format: v })}>
              <SelectTrigger size="sm" className="h-6 text-xs py-0 w-20">
                <span className="text-xs truncate">
                  {fmtOpts.find((o) => o.value === ((item.format as string) ?? 'none'))?.label ?? 'raw'}
                </span>
              </SelectTrigger>
              <SelectContent>
                {fmtOpts.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isTime && (
              <input
                type="number"
                min={0}
                max={9}
                value={(item.precision as number) ?? 0}
                onChange={(e) => setRow(idx, { precision: parseInt(e.target.value) || 0 })}
                className="h-6 w-10 rounded-sm border border-input bg-transparent px-1 py-0.5 text-[10px] text-center"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
