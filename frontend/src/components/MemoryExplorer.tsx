import { Brain, Search, Loader2, AlertTriangle, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useSearchMemory } from '@/hooks/use-search-memory'
import type { MemoryMatch } from '@/services/memory.service'
import type { ClientContext } from '@/types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractPreview(text: string): string {
  const firstLine = text.split('\n')[0] ?? ''
  // Strip the "Hook: " label — the content itself is the meaningful signal
  return firstLine.replace(/^Hook:\s*/i, '').trim()
}

function qualityTier(score: number): { label: string; className: string } {
  if (score >= 0.70) return { label: 'Strong Match', className: 'bg-green-500/10 text-green-400' }
  return { label: 'Related', className: 'bg-yellow-500/10 text-yellow-400' }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-10 w-full rounded-md" />
      ))}
    </div>
  )
}

function WarningBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-yellow-500/20 bg-yellow-500/5 px-3 py-2.5">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-400" />
      <p className="text-xs text-yellow-300/80">{message}</p>
    </div>
  )
}

function EmptyMatches() {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2.5">
      <SearchX className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
      <p className="text-xs text-muted-foreground">
        No matches above threshold. Run a pipeline and approve ideas to build memory.
      </p>
    </div>
  )
}

function MatchRow({ match }: { match: MemoryMatch }) {
  const preview = extractPreview(match.text)
  const pct = Math.round(match.similarity * 100)
  const tier = qualityTier(match.similarity)

  return (
    <div className="flex items-start gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2.5">
      <span
        className={cn(
          'mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
          match.sourceType === 'idea'
            ? 'bg-primary/10 text-primary'
            : 'bg-purple-500/10 text-purple-400',
        )}
      >
        {match.sourceType}
      </span>
      <p className="min-w-0 flex-1 truncate text-xs text-foreground">{preview}</p>
      <div className="flex shrink-0 items-center gap-1.5">
        <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', tier.className)}>
          {tier.label}
        </span>
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          {pct}%
        </span>
      </div>
    </div>
  )
}

function MatchList({ matches }: { matches: MemoryMatch[] }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
        {matches.length} match{matches.length === 1 ? '' : 'es'} · sorted by similarity
      </p>
      {matches.map((m) => (
        <MatchRow key={m.sourceId} match={m} />
      ))}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface MemoryExplorerProps {
  client: ClientContext
}

export function MemoryExplorer({ client }: MemoryExplorerProps) {
  const mutation = useSearchMemory()

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-primary" />
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Memory Explorer
        </p>
      </div>

      {/* Body — one of four states */}
      {mutation.isPending && <SkeletonRows />}

      {mutation.isIdle && (
        <p className="text-xs text-muted-foreground">
          Search semantic memory before running a new pipeline.
        </p>
      )}

      {mutation.isSuccess && mutation.data && (
        <>
          {mutation.data.warning && <WarningBanner message={mutation.data.warning} />}
          {mutation.data.matches.length === 0 && !mutation.data.warning && <EmptyMatches />}
          {mutation.data.matches.length > 0 && <MatchList matches={mutation.data.matches} />}
        </>
      )}

      {mutation.isError && (
        <p className="text-xs text-destructive">
          {(mutation.error as { message?: string } | null)?.message ?? 'Search failed'}
        </p>
      )}

      {/* Search button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2"
        onClick={() => mutation.mutate(client)}
        disabled={mutation.isPending}
      >
        {mutation.isPending ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Searching…
          </>
        ) : (
          <>
            <Search className="h-3.5 w-3.5" />
            Search Memory
          </>
        )}
      </Button>
    </div>
  )
}
