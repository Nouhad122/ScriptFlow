import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

function buildPages(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const result: (number | 'ellipsis')[] = []
  result.push(1)

  if (current > 3) result.push('ellipsis')

  const lo = Math.max(2, current - 1)
  const hi = Math.min(total - 1, current + 1)
  for (let i = lo; i <= hi; i++) result.push(i)

  if (current < total - 2) result.push('ellipsis')

  result.push(total)
  return result
}

interface PaginationProps {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  compact?: boolean
  className?: string
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  compact = false,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null

  const start = (page - 1) * pageSize + 1
  const end   = Math.min(page * pageSize, total)

  if (compact) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-between border-t border-border px-3 py-2',
          className,
        )}
      >
        <span className="text-[11px] text-muted-foreground">
          {start}–{end} of {total}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 1}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-12 text-center text-[11px] text-muted-foreground">
            {page}&thinsp;/&thinsp;{totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page === totalPages}
            className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  const pages = buildPages(page, totalPages)

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-between border-t border-border px-6 py-3',
        className,
      )}
    >
      <span className="text-xs text-muted-foreground">
        {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span
              key={`e-${i}`}
              className="flex h-7 w-7 items-center justify-center text-xs text-muted-foreground"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium transition-colors',
                p === page
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {p}
            </button>
          ),
        )}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
