import { useState } from 'react'
import { MoreHorizontal, RefreshCw, AlertCircle, Loader2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { ReactNode } from 'react'

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
    <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="truncate text-sm font-medium">{title}</span>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus:outline-none">
            <MoreHorizontal className="h-3 w-3" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-28">
            <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={onClone}>Clone</DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-auto p-3">
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
