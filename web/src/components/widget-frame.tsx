import { AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from './ui/context-menu'

interface WidgetFrameProps {
  title: string
  loading?: boolean
  error?: string | null
  hasData?: boolean
  onRetry?: () => void
  onEdit?: () => void
  onClone?: () => void
  onDelete?: () => void
  children?: ReactNode
}

export function WidgetFrame({
  title,
  loading,
  error,
  hasData,
  onRetry,
  onEdit,
  onClone,
  onDelete,
  children,
}: WidgetFrameProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-4xl border drag-handle bg-cyan-900/10 backdrop-blur-xs" onDoubleClick={onEdit}>
      <ContextMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <ContextMenuTrigger className="justify-center rounded-md pt-2 text-muted-foreground">
          {title && (
            <div className="group flex cursor-move justify-between px-3 pt-1.5 pb-1.5">
              <span className="truncate text-sm font-medium">{title}</span>
            </div>
          )}
        </ContextMenuTrigger>
        <ContextMenuContent align="end" className="w-28">
          <ContextMenuItem onClick={onEdit}>Edit</ContextMenuItem>
          <ContextMenuItem onClick={onClone}>Clone</ContextMenuItem>
          <ContextMenuItem onClick={onDelete} className="text-destructive">
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <div className="flex-1 overflow-auto p-0">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <span>{error}</span>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                <RefreshCw className="mr-1 h-3 w-3" /> Retry
              </Button>
            )}
          </div>
        ) : hasData === false ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No data
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

export function WidgetSkeleton() {
  return (
    <div className="flex h-full flex-col rounded-lg border bg-card">
      <div className="border-b px-3 py-2">
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex flex-1 items-center justify-center p-3">
        <Skeleton className="h-20 w-20 rounded-full" />
      </div>
    </div>
  )
}
