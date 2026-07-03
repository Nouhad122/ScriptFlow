import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Lightbulb,
  Search,
  Check,
  X,
  ChevronDown,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { PageContainer } from '@/components/PageContainer'
import { SectionHeader } from '@/components/SectionHeader'
import { EmptyState } from '@/components/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { usePendingIdeas } from '@/hooks/use-pending-ideas'
import { useApproveIdea } from '@/hooks/use-approve-idea'
import { useRejectIdea } from '@/hooks/use-reject-idea'
import type { Idea, IceScore } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────

type RecommendationFilter = 'ALL' | 'APPROVE' | 'CONSIDER' | 'REJECT'
type SortKey = 'newest' | 'impact' | 'confidence' | 'ease'

// Ideas returned by the backend always have iceScore populated (pipeline always
// scores before saving), but the DB column is nullable. This type represents a
// fully-scored idea — `Omit` drops the nullable version so the intersection
// resolves cleanly to IceScore (not IceScore | null).
type ScoredIdea = Omit<Idea, 'iceScore'> & { iceScore: IceScore }

// ── Utility helpers ──────────────────────────────────────────────────────────

function relativeTime(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(createdAt).toLocaleDateString()
}

function iceColor(score: number): string {
  if (score >= 8) return 'bg-green-500/10 text-green-400 border-green-500/20'
  if (score >= 5) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
  return 'bg-red-500/10 text-red-400 border-red-500/20'
}

const REC_CONFIG: Record<'APPROVE' | 'CONSIDER' | 'REJECT', { label: string; className: string }> = {
  APPROVE:  { label: 'Approve',  className: 'bg-green-500/10 text-green-400 border-green-500/20' },
  CONSIDER: { label: 'Consider', className: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  REJECT:   { label: 'Reject',   className: 'bg-red-500/10 text-red-400 border-red-500/20' },
}

// ── Sub-components ───────────────────────────────────────────────────────────

function IceScoreBadge({ label, score }: { label: string; score: number }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        iceColor(score),
      )}
    >
      <span className="font-normal opacity-70">{label}</span>
      <span className="font-bold">{score}</span>
    </span>
  )
}

function RecommendationBadge({ rec }: { rec: 'APPROVE' | 'CONSIDER' | 'REJECT' }) {
  const { label, className } = REC_CONFIG[rec]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        className,
      )}
    >
      {label}
    </span>
  )
}

function ReasoningBlock({
  label,
  score,
  reason,
}: {
  label: string
  score: number
  reason: string
}) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-card/60 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span
          className={cn(
            'rounded border px-1.5 py-0.5 text-xs font-bold',
            iceColor(score),
          )}
        >
          {score}/10
        </span>
      </div>
      <p className="text-xs leading-relaxed text-foreground/75">{reason}</p>
    </div>
  )
}

// ── IdeaCard ─────────────────────────────────────────────────────────────────

interface IdeaCardProps {
  idea: ScoredIdea
  expanded: boolean
  onToggleExpand: () => void
  onApprove: () => void
  onReject: () => void
  isApproving: boolean
  isRejecting: boolean
  isAnyMutating: boolean
}

function IdeaCard({
  idea,
  expanded,
  onToggleExpand,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  isAnyMutating,
}: IdeaCardProps) {
  const ice: IceScore = idea.iceScore

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* ── Collapsed view ─────────────────────────────────────────────── */}
      <div className="p-4">
        <div className="flex items-start gap-4">
          {/* Content */}
          <div className="min-w-0 flex-1 space-y-2.5">
            <p className="text-sm font-medium leading-snug text-foreground">
              {idea.hookLine}
            </p>

            {/* Tag row */}
            <div className="flex flex-wrap items-center gap-1.5">
              <RecommendationBadge rec={ice.recommendation} />
              <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                {idea.creativeType}
              </span>
              <span className="inline-flex items-center rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                {idea.leadType}
              </span>
            </div>

            {/* Avatar + Pain */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                <span className="font-medium text-foreground/60">Avatar</span>{' '}
                {idea.targetAvatar}
              </span>
              <span className="text-border">·</span>
              <span className="max-w-[320px] truncate">{idea.targetPain}</span>
            </div>

            {/* ICE scores + meta */}
            <div className="flex flex-wrap items-center gap-2">
              <IceScoreBadge label="Impact" score={ice.impact} />
              <IceScoreBadge label="Confidence" score={ice.confidence} />
              <IceScoreBadge label="Ease" score={ice.ease} />
              {idea.supportingProofPoints.length > 0 && (
                <span className="ml-1 text-[10px] text-muted-foreground/60">
                  {idea.supportingProofPoints.length} proof points
                </span>
              )}
              <span className="ml-auto text-[10px] text-muted-foreground/50">
                {relativeTime(idea.createdAt)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-2 self-start">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={onApprove}
              disabled={isAnyMutating}
            >
              {isApproving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Approve
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-muted-foreground hover:border-destructive/40 hover:text-destructive"
              onClick={onReject}
              disabled={isAnyMutating}
            >
              {isRejecting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              Reject
            </Button>

            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground"
              onClick={onToggleExpand}
            >
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  expanded && 'rotate-180',
                )}
              />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Expanded view ──────────────────────────────────────────────── */}
      {expanded && (
        <div className="space-y-4 border-t border-border bg-muted/20 p-4">
          {/* ICE reasoning */}
          <div className="grid grid-cols-3 gap-3">
            <ReasoningBlock label="Impact" score={ice.impact} reason={ice.impactReason} />
            <ReasoningBlock label="Confidence" score={ice.confidence} reason={ice.confidenceReason} />
            <ReasoningBlock label="Ease" score={ice.ease} reason={ice.easeReason} />
          </div>

          {/* Overall reasoning */}
          <div className="rounded-md border border-border bg-card/50 p-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Overall reasoning
            </p>
            <p className="text-xs leading-relaxed text-foreground/80">
              {ice.overallReasoning}
            </p>
          </div>

          {/* Supporting proof */}
          {idea.supportingProofPoints.length > 0 && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Supporting proof
              </p>
              <ul className="space-y-1.5">
                {idea.supportingProofPoints.map((point, i) => (
                  <li key={i} className="flex gap-2 text-xs text-foreground/75">
                    <span className="mt-0.5 shrink-0 text-muted-foreground">·</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer meta */}
          <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
            <span>
              Pipeline{' '}
              <span className="font-mono text-[11px] text-foreground/60">
                {idea.pipelineRunId.slice(0, 12)}…
              </span>
            </span>
            <span>{new Date(idea.createdAt).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Skeleton loading state ────────────────────────────────────────────────────

function IdeaListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-start gap-4">
            <div className="flex-1 space-y-2.5">
              <Skeleton className="h-4 w-3/4" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-3 w-1/2" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Skeleton className="h-8 w-20 rounded-md" />
              <Skeleton className="h-8 w-16 rounded-md" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Error state ───────────────────────────────────────────────────────────────

function FetchError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border py-16">
      <AlertCircle className="h-8 w-8 text-muted-foreground" />
      <div className="space-y-1 text-center">
        <p className="text-sm font-medium text-foreground">Failed to load ideas</p>
        <p className="text-xs text-muted-foreground">
          There was a problem fetching pending ideas.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function IdeaIntelligencePage() {
  const navigate = useNavigate()
  const { data: ideas = [], isLoading, isError, refetch } = usePendingIdeas()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<RecommendationFilter>('ALL')
  const [sort, setSort] = useState<SortKey>('newest')
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set())
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const approveMutation = useApproveIdea()
  const rejectMutation = useRejectIdea()
  const isAnyMutating = approveMutation.isPending || rejectMutation.isPending

  const displayedIdeas = useMemo<ScoredIdea[]>(() => {
    let list: ScoredIdea[] = ideas.filter((i): i is ScoredIdea => i.iceScore !== null)

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (i) =>
          i.hookLine.toLowerCase().includes(q) ||
          i.targetAvatar.toLowerCase().includes(q) ||
          i.creativeType.toLowerCase().includes(q),
      )
    }

    if (filter !== 'ALL') {
      list = list.filter((i) => i.iceScore.recommendation === filter)
    }

    return [...list].sort((a, b) => {
      if (sort === 'newest')
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (sort === 'impact') return b.iceScore.impact - a.iceScore.impact
      if (sort === 'confidence') return b.iceScore.confidence - a.iceScore.confidence
      if (sort === 'ease') return b.iceScore.ease - a.iceScore.ease
      return 0
    })
  }, [ideas, search, filter, sort])

  const handleApprove = (id: string) => {
    approveMutation.mutate(id, {
      onSuccess: () => setDismissingIds((prev) => new Set(prev).add(id)),
    })
  }

  const handleReject = (id: string) => {
    rejectMutation.mutate(id, {
      onSuccess: () => setDismissingIds((prev) => new Set(prev).add(id)),
    })
  }

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clearFilters = () => {
    setSearch('')
    setFilter('ALL')
  }

  const isFiltered = search.trim() !== '' || filter !== 'ALL'

  return (
    <PageContainer className="max-w-5xl">
      <div className="space-y-6">
        {/* Header */}
        <SectionHeader
          title="Idea Intelligence"
          description="Review and approve AI-generated content ideas before script generation."
          action={
            ideas.length > 0 ? (
              <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {ideas.length} pending
              </span>
            ) : undefined
          }
        />

        {/* Loading */}
        {isLoading && <IdeaListSkeleton />}

        {/* Error */}
        {isError && <FetchError onRetry={() => void refetch()} />}

        {/* Empty — no ideas at all */}
        {!isLoading && !isError && ideas.length === 0 && (
          <EmptyState
            icon={Lightbulb}
            title="No pending ideas"
            description="Run a new pipeline to generate content."
            action={{
              label: 'Go to Automation',
              onClick: () => navigate('/automation'),
            }}
          />
        )}

        {/* Content — has ideas */}
        {!isLoading && !isError && ideas.length > 0 && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by hook, avatar, or type…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select
                value={filter}
                onValueChange={(v) => setFilter(v as RecommendationFilter)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Recommendation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All recommendations</SelectItem>
                  <SelectItem value="APPROVE">Approve</SelectItem>
                  <SelectItem value="CONSIDER">Consider</SelectItem>
                  <SelectItem value="REJECT">Reject</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={sort}
                onValueChange={(v) => setSort(v as SortKey)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="impact">Highest Impact</SelectItem>
                  <SelectItem value="confidence">Highest Confidence</SelectItem>
                  <SelectItem value="ease">Highest Ease</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Results count */}
            {isFiltered && (
              <p className="text-xs text-muted-foreground">
                {displayedIdeas.length} of {ideas.length} ideas
                {filter !== 'ALL' && (
                  <span className="ml-1 font-medium text-foreground/70">
                    · {REC_CONFIG[filter as Exclude<RecommendationFilter, 'ALL'>]?.label ?? filter}
                  </span>
                )}
                {search.trim() && (
                  <span>
                    {' '}
                    matching &ldquo;{search.trim()}&rdquo;
                  </span>
                )}
                <button
                  className="ml-2 text-primary hover:underline"
                  onClick={clearFilters}
                >
                  Clear
                </button>
              </p>
            )}

            {/* Empty — no filter results */}
            {displayedIdeas.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-12 text-center">
                <p className="text-sm text-muted-foreground">
                  No ideas match your filters.
                </p>
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {displayedIdeas.map((idea) => (
                  <div
                    key={idea.id}
                    className={cn(
                      'transition-opacity duration-200',
                      dismissingIds.has(idea.id) ? 'opacity-0' : 'opacity-100',
                    )}
                  >
                    <IdeaCard
                      idea={idea}
                      expanded={expandedIds.has(idea.id)}
                      onToggleExpand={() => toggleExpanded(idea.id)}
                      onApprove={() => handleApprove(idea.id)}
                      onReject={() => handleReject(idea.id)}
                      isApproving={
                        approveMutation.isPending &&
                        approveMutation.variables === idea.id
                      }
                      isRejecting={
                        rejectMutation.isPending &&
                        rejectMutation.variables === idea.id
                      }
                      isAnyMutating={isAnyMutating}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  )
}
