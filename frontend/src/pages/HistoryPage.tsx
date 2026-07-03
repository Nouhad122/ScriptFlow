import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  History,
  AlertCircle,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { cn } from '@/lib/utils'
import { usePipelineHistory } from '@/hooks/use-pipeline-history'
import { MOCK_CLIENTS } from '@/data/mock-clients'
import type { PipelineRunRecord, PipelineAnalytics, PipelineStatus } from '@/types'

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatDuration(ms: number | null): string {
  if (ms === null || ms === 0) return '—'
  if (ms < 1_000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`
  const mins = Math.floor(ms / 60_000)
  const secs = Math.floor((ms % 60_000) / 1_000)
  return `${mins}m ${secs}s`
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function clientName(clientId: string): string {
  return MOCK_CLIENTS.find(c => c.id === clientId)?.name ?? clientId
}

function shortenId(id: string): string {
  return id.slice(0, 12)
}

// ── Constants ─────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | PipelineStatus
type SortKey = 'newest' | 'oldest' | 'fastest' | 'slowest'

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed',    label: 'Failed' },
]

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest',  label: 'Newest first' },
  { value: 'oldest',  label: 'Oldest first' },
  { value: 'fastest', label: 'Fastest first' },
  { value: 'slowest', label: 'Slowest first' },
]

// Stage names used by the orchestrator failure paths
const STAGE_ORDER: { key: string; label: string }[] = [
  { key: 'IdeaGeneration', label: 'Idea Generation' },
  { key: 'IceScoring',     label: 'ICE Scoring' },
  { key: 'Persistence',    label: 'Persistence' },
]

// ── Analytics cards ───────────────────────────────────────────────────────────

function AnalyticsCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function AnalyticsSection({ analytics }: { analytics: PipelineAnalytics }) {
  const successColor =
    analytics.successRate >= 90 ? 'text-green-400' :
    analytics.successRate >= 70 ? 'text-yellow-400' : 'text-red-400'

  return (
    <div className="grid grid-cols-4 gap-3">
      <AnalyticsCard
        label="Total Runs"
        value={String(analytics.totalRuns)}
        sub={`${analytics.completedRuns} completed · ${analytics.failedRuns} failed`}
      />
      <AnalyticsCard
        label="Success Rate"
        value={
          analytics.totalRuns > 0
            ? `${analytics.successRate}%`
            : '—'
        }
        sub={analytics.totalRuns === 0 ? 'No runs yet' : undefined}
      />
      <AnalyticsCard
        label="Avg Execution"
        value={formatDuration(analytics.averageTotalMs)}
        sub={analytics.averageTotalMs === null ? 'No timing data yet' : undefined}
      />
      <AnalyticsCard
        label="Longest Run"
        value={formatDuration(analytics.longestTotalMs)}
        sub={
          analytics.fastestTotalMs !== null
            ? `Fastest: ${formatDuration(analytics.fastestTotalMs)}`
            : undefined
        }
      />
      {/* suppress unused-variable lint for successColor when it only applies to the card */}
      <span className={cn('hidden', successColor)} />
    </div>
  )
}

// ── Table skeleton ────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b border-border">
          {Array.from({ length: 9 }).map((__, j) => (
            <td key={j} className="px-4 py-3">
              <Skeleton className="h-3.5 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

// ── Drawer ────────────────────────────────────────────────────────────────────

type TimelineStepStatus = 'completed' | 'failed' | 'skipped' | 'pending'

interface TimelineStep {
  label: string
  status: TimelineStepStatus
  timing: string | null
  note?: string
}

function buildTimeline(run: PipelineRunRecord): TimelineStep[] {
  const hasTimings = run.totalMs !== null
  const failedIdx = run.failedStage
    ? STAGE_ORDER.findIndex(s => s.key === run.failedStage)
    : -1

  const stageStatus = (idx: number): TimelineStepStatus => {
    if (run.status === 'completed') return 'completed'
    if (failedIdx === -1) return 'completed'
    if (idx < failedIdx) return 'completed'
    if (idx === failedIdx) return 'failed'
    return 'skipped'
  }

  const stageTiming = (ms: number | null): string | null => {
    if (!hasTimings || ms === null) return null
    return formatDuration(ms)
  }

  return [
    {
      label: 'Pipeline Started',
      status: 'completed',
      timing: formatDateTime(run.startedAt),
    },
    {
      label: 'Idea Generation',
      status: stageStatus(0),
      timing: stageTiming(run.ideaGenerationMs),
      note: failedIdx === 0 ? (run.errorMessage ?? undefined) : undefined,
    },
    {
      label: 'ICE Scoring',
      status: stageStatus(1),
      timing: stageTiming(run.iceScoringMs),
      note: failedIdx === 1 ? (run.errorMessage ?? undefined) : undefined,
    },
    {
      label: 'Persistence',
      status: stageStatus(2),
      timing: stageTiming(run.persistenceMs),
      note: failedIdx === 2 ? (run.errorMessage ?? undefined) : undefined,
    },
    {
      label: run.status === 'failed' ? 'Failed' : 'Completed',
      status: run.status === 'completed' ? 'completed' : 'failed',
      timing: run.completedAt ? formatDateTime(run.completedAt) : null,
    },
  ]
}

function TimelineStepRow({
  step,
  isLast,
}: {
  step: TimelineStep
  isLast: boolean
}) {
  const dotClass =
    step.status === 'completed' ? 'border-green-500 bg-green-500/20'  :
    step.status === 'failed'    ? 'border-red-500   bg-red-500/20'    :
    step.status === 'skipped'   ? 'border-border    bg-muted/30'       :
                                  'border-border    bg-muted/30'

  const IconComp =
    step.status === 'completed' ? CheckCircle2 :
    step.status === 'failed'    ? XCircle       :
    null

  const iconClass =
    step.status === 'completed' ? 'text-green-400' :
    step.status === 'failed'    ? 'text-red-400'   :
    'text-muted-foreground'

  return (
    <div className="flex gap-3">
      {/* Dot + connector */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
            dotClass,
          )}
        >
          {IconComp && (
            <IconComp className={cn('h-2.5 w-2.5', iconClass)} />
          )}
        </div>
        {!isLast && <div className="mt-1 w-px flex-1 bg-border" />}
      </div>

      {/* Content */}
      <div className={cn('min-w-0 flex-1', isLast ? 'pb-0' : 'pb-5')}>
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={cn(
              'text-sm font-medium',
              step.status === 'skipped' ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {step.label}
          </p>
          {step.timing && (
            <span className="shrink-0 text-xs text-muted-foreground">{step.timing}</span>
          )}
          {!step.timing && step.status !== 'skipped' && (
            <span className="shrink-0 text-xs text-muted-foreground/40">—</span>
          )}
        </div>
        {step.note && (
          <p className="mt-1 text-xs leading-relaxed text-red-400/80">{step.note}</p>
        )}
      </div>
    </div>
  )
}

function RunDrawer({
  run,
  onClose,
}: {
  run: PipelineRunRecord
  onClose: () => void
}) {
  const steps = buildTimeline(run)
  const hasTimings = run.totalMs !== null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-125 flex-col border-l border-border bg-background shadow-2xl">
        {/* Drawer header */}
        <div className="flex shrink-0 items-start justify-between border-b border-border px-6 py-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <StatusBadge status={run.status} />
              <span className="font-mono text-xs text-muted-foreground">
                {shortenId(run.id)}…
              </span>
            </div>
            <p className="text-base font-semibold text-foreground">
              {clientName(run.clientId)}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDateTime(run.startedAt)} · {formatDuration(run.totalMs)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Timeline */}
          <div className="border-b border-border px-6 py-5">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Execution Timeline
            </p>
            {!hasTimings && (
              <p className="mb-3 text-xs text-muted-foreground/60">
                Stage timing data is unavailable for pipeline runs executed before history tracking was enabled.
              </p>
            )}
            <div>
              {steps.map((step, i) => (
                <TimelineStepRow key={step.label} step={step} isLast={i === steps.length - 1} />
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="px-6 py-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Summary
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">Ideas Generated</p>
                <p className="mt-0.5 text-xl font-bold text-foreground">{run.totalIdeas}</p>
              </div>
              <div className="rounded-lg border border-border bg-card px-4 py-3">
                <p className="text-xs text-muted-foreground">Total Duration</p>
                <p className="mt-0.5 text-xl font-bold text-foreground">
                  {formatDuration(run.totalMs)}
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-lg border border-border bg-card">
              <div className="border-b border-border px-4 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  ICE Recommendations
                </p>
              </div>
              <div className="divide-y divide-border">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-green-400">Approve</span>
                  <span className="text-sm font-semibold text-foreground">
                    {run.approvedCandidates}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-yellow-400">Consider</span>
                  <span className="text-sm font-semibold text-foreground">
                    {run.considerCandidates}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm text-red-400">Reject</span>
                  <span className="text-sm font-semibold text-foreground">
                    {run.rejectedCandidates}
                  </span>
                </div>
              </div>
            </div>

            {run.status === 'failed' && run.failedStage && (
              <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
                <p className="text-xs font-semibold text-red-400">
                  Failed at: {run.failedStage}
                </p>
                {run.errorMessage && (
                  <p className="mt-1 text-xs leading-relaxed text-red-400/70">
                    {run.errorMessage}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function HistoryPage() {
  const navigate = useNavigate()
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [search, setSearch]               = useState('')
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>('all')
  const [sort, setSort]                   = useState<SortKey>('newest')
  const [sortOpen, setSortOpen]           = useState(false)

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = usePipelineHistory()

  const runs      = data?.runs      ?? []
  const analytics = data?.analytics ?? null

  const selectedRun = runs.find(r => r.id === selectedRunId) ?? null

  // Close drawer on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setSelectedRunId(null)
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Close sort dropdown on outside click
  useEffect(() => {
    if (!sortOpen) return
    const handler = () => setSortOpen(false)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [sortOpen])

  const countByStatus = useMemo(() => {
    const counts: Record<string, number> = { all: runs.length }
    for (const r of runs) counts[r.status] = (counts[r.status] ?? 0) + 1
    return counts
  }, [runs])

  const filteredRuns = useMemo(() => {
    let list = runs

    // Search
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        r =>
          r.id.toLowerCase().includes(q) ||
          clientName(r.clientId).toLowerCase().includes(q),
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter(r => r.status === statusFilter)
    }

    // Sort
    return [...list].sort((a, b) => {
      if (sort === 'newest') return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      if (sort === 'oldest') return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
      if (sort === 'fastest') {
        if (a.totalMs === null && b.totalMs === null) return 0
        if (a.totalMs === null) return 1
        if (b.totalMs === null) return -1
        return a.totalMs - b.totalMs
      }
      if (sort === 'slowest') {
        if (a.totalMs === null && b.totalMs === null) return 0
        if (a.totalMs === null) return 1
        if (b.totalMs === null) return -1
        return b.totalMs - a.totalMs
      }
      return 0
    })
  }, [runs, search, statusFilter, sort])

  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sort)?.label ?? 'Newest first'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">

      {/* Header */}
      <div className="shrink-0 border-b border-border px-6 py-5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Pipeline History
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Browse previous AI pipeline executions.
        </p>
      </div>

      {/* Analytics */}
      <div className="shrink-0 border-b border-border px-6 py-4">
        {isLoading && (
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-19 rounded-lg" />
            ))}
          </div>
        )}
        {analytics && <AnalyticsSection analytics={analytics} />}
        {!isLoading && !analytics && (
          <div className="grid grid-cols-4 gap-3">
            {['Total Runs', 'Success Rate', 'Avg Execution', 'Longest Run'].map(label => (
              <AnalyticsCard key={label} label={label} value="—" />
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="shrink-0 border-b border-border px-6 py-3">
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by ID or client…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Status filter tabs */}
          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  statusFilter === tab.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'rounded-full px-1 py-0.5 text-[10px] leading-none',
                    statusFilter === tab.value
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-muted-foreground/15 text-muted-foreground',
                  )}
                >
                  {countByStatus[tab.value] ?? 0}
                </span>
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="relative ml-auto">
            <button
              onClick={e => { e.stopPropagation(); setSortOpen(v => !v) }}
              className="flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {currentSortLabel}
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-border bg-card shadow-lg">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={e => { e.stopPropagation(); setSort(opt.value); setSortOpen(false) }}
                    className={cn(
                      'w-full px-3 py-2 text-left text-xs transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-muted',
                      sort === opt.value ? 'font-semibold text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full min-w-215 text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-background">
            <tr>
              {[
                'Pipeline ID', 'Client', 'Started', 'Duration',
                'Ideas', 'Approve', 'Consider', 'Reject', 'Status',
              ].map(col => (
                <th
                  key={col}
                  className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Loading */}
            {isLoading && <TableSkeleton />}

            {/* Error */}
            {isError && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <AlertCircle className="h-6 w-6 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Failed to load pipeline history.
                    </p>
                    <Button size="sm" variant="outline" onClick={() => void refetch()}>
                      Retry
                    </Button>
                  </div>
                </td>
              </tr>
            )}

            {/* Empty — no runs at all */}
            {!isLoading && !isError && runs.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <History className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        No pipeline executions yet
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Run a pipeline to start building your execution history.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/automation')}
                    >
                      Go to Automation
                    </Button>
                  </div>
                </td>
              </tr>
            )}

            {/* Empty — search/filter has no results */}
            {!isLoading &&
              !isError &&
              runs.length > 0 &&
              filteredRuns.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <p className="text-sm text-muted-foreground">
                      No runs match your search or filter.
                    </p>
                  </td>
                </tr>
              )}

            {/* Data rows */}
            {filteredRuns.map(run => (
              <tr
                key={run.id}
                className={cn(
                  'cursor-pointer border-b border-border transition-colors hover:bg-muted/40',
                  selectedRunId === run.id && 'bg-primary/5',
                )}
                onClick={() => setSelectedRunId(run.id)}
              >
                {/* Pipeline ID */}
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-foreground">
                    {shortenId(run.id)}…
                  </span>
                </td>

                {/* Client */}
                <td className="px-4 py-3">
                  <span className="text-foreground">{clientName(run.clientId)}</span>
                </td>

                {/* Started */}
                <td className="px-4 py-3">
                  <span
                    className="text-muted-foreground"
                    title={formatDateTime(run.startedAt)}
                  >
                    {relativeTime(run.startedAt)}
                  </span>
                </td>

                {/* Duration */}
                <td className="px-4 py-3">
                  <span className="text-foreground">{formatDuration(run.totalMs)}</span>
                </td>

                {/* Ideas */}
                <td className="px-4 py-3">
                  <span className="font-medium text-foreground">{run.totalIdeas}</span>
                </td>

                {/* Approve */}
                <td className="px-4 py-3">
                  <span className="font-medium text-green-400">{run.approvedCandidates}</span>
                </td>

                {/* Consider */}
                <td className="px-4 py-3">
                  <span className="font-medium text-yellow-400">{run.considerCandidates}</span>
                </td>

                {/* Reject */}
                <td className="px-4 py-3">
                  <span className="font-medium text-red-400">{run.rejectedCandidates}</span>
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <StatusBadge status={run.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      {selectedRun && (
        <RunDrawer run={selectedRun} onClose={() => setSelectedRunId(null)} />
      )}
    </div>
  )
}
