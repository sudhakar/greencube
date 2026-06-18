import type { ComponentType, ReactNode, MouseEventHandler } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { InputGroup, InputGroupAddon, InputGroupButton } from '@/components/ui/input-group'
import { Plus, X } from 'lucide-react'

export const FieldSelect: ComponentType<any> = ({ value, onChange, options }) => {
  const fields = options?.fields ?? []
  return (
    <Select value={value || ''} onValueChange={(v) => onChange(v)}>
      <SelectTrigger size="sm" className="h-7 text-xs">
        <SelectValue placeholder="Select field" />
      </SelectTrigger>
      <SelectContent>
        {fields.map((f: string) => (
          <SelectItem key={f} value={f} className="text-xs">
            {f}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function CompactArrayItemTemplate({ children, hasToolbar, buttonsProps }: { children: ReactNode; hasToolbar?: boolean; buttonsProps?: { onRemoveItem?: () => void } }) {
  return (
    <InputGroup className="h-7 mb-1">
      <div className="flex-1">{children}</div>
      {hasToolbar && buttonsProps?.onRemoveItem && (
        <InputGroupAddon align="inline-end" className="p-0">
          <InputGroupButton size="icon-xs" variant="ghost" onClick={buttonsProps.onRemoveItem}>
            <X className="size-3" />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}

export function CompactAddButton({ onClick, disabled }: { onClick?: MouseEventHandler<HTMLButtonElement>; disabled?: boolean }) {
  return (
    <InputGroupButton size="xs" variant="outline" onClick={onClick} disabled={disabled} className="w-fit gap-1 text-xs">
      <Plus className="size-3" /> Add
    </InputGroupButton>
  )
}
