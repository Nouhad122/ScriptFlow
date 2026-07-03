import { useState, useMemo } from 'react'
import { CheckCircle2, XCircle, ShieldCheck, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { cn } from '@/lib/utils'
import { useScripts } from '@/hooks/use-scripts'
import { useReviewForScript } from '@/hooks/use-review-for-script'
import { useRunQualityReview } from '@/hooks/use-run-quality-review'
import { MOCK_CLIENTS } from '@/data/mock-clients'
import type { ScriptWithHook, QualityReview, QualityChecks, ScriptStatus } from '@/types'

// ── Utilities ─────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function scoreChipClass(score: number): string {
  if (score >= 8) return 'bg-green-500/10 text-green-400 border-green-500/20'
  if (score >= 5) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
  return 'bg-red-500/10 text-red-400 border-red-500/20'
}

// ── Constants ─────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | ScriptStatus

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all',            label: 'All' },
  { value: 'pending_review', label: 'Pending' },
  { value: 'passed',         label: 'Passed' },
  { value: 'held',           label: 'Held' },
]

const CHECK_ENTRIES: [keyof QualityChecks, string][] = [
  ['hookStrength',      'Hook Strength'],
  ['problemClarity',    'Problem Clarity'],
  ['storyFlow',         'Story Flow'],
  ['solutionAlignment', 'Solution Alignment'],
  ['proofAccuracy',     'Proof Accuracy'],
  ['ctaAlignment',      'CTA Alignment'],
  ['brandVoice',        'Brand Voice'],
  ['fabrication',       'Fabrication'],
  ['length',            'Length'],
  ['structure',         'Structure'],
]

// ── Check row ─────────────────────────────────────────────────────────────────

function CheckRow({ label, check }: { label: string; check: QualityChecks[keyof QualityChecks] }) {
  const Icon = check.pass ? CheckCircle2 : XCircle
  const isScored = 'score' in check

  return (
    <div className="flex items-start gap-3 border-b border-border py-3 last:border-0">
      <Icon
        className={cn('mt-0.5 h-4 w-4 shrink-0', check.pass ? 'text-green-400' : 'text-red-400')}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
          {isScored ? (
            <span
              className={cn(
                'shrink-0 rounded border px-1.5 py-0.5 text-xs font-bold',
                scoreChipClass((check as { score: number }).score),
              )}
            >
              {(check as { score: number }).score}/10
            </span>
          ) : (
            <span
              className={cn(
                'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                check.pass ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400',
              )}
            >
              {check.pass ? 'Pass' : 'Fail'}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{check.reason}</p>
      </div>
    </div>
  )
}

// ── Review panel ──────────────────────────────────────────────────────────────

function ReviewPanel({ review }: { review: QualityReview }) {
  const isPassed = review.overallDecision === 'PASS'

  return (
    <div className="space-y-4 p-6">
      {/* Overall result */}
      <div
        className={cn(
          'rounded-lg border p-4',
          isPassed
            ? 'border-green-500/20 bg-green-500/5'
            : 'border-orange-500/20 bg-orange-500/5',
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isPassed ? (
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            ) : (
              <XCircle className="h-5 w-5 text-orange-400" />
            )}
            <div>
              <p className="text-sm font-semibold text-foreground">Quality Review</p>
              <p className="text-xs text-muted-foreground">
                {new Date(review.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p
              className={cn(
                'text-3xl font-bold',
                isPassed ? 'text-green-400' : 'text-orange-400',
              )}
            >
              {review.overallScore}
            </p>
            <p className="text-[10px] text-muted-foreground">/ 100</p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <StatusBadge status={review.overallDecision} />
          <span className="text-xs text-muted-foreground">
            {isPassed
              ? 'Script passed quality review and is ready for delivery.'
              : 'Script held — one or more checks failed or scored below threshold.'}
          </span>
        </div>
      </div>

      {/* Check list */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Quality Checks
          </p>
        </div>
        <div className="px-4">
          {CHECK_ENTRIES.map(([key, label]) => (
            <CheckRow key={key} label={label} check={review.checks[key]} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Right-panel states ────────────────────────────────────────────────────────

function EmptyRightPanel() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <ShieldCheck className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">No script selected</p>
        <p className="max-w-56 text-xs text-muted-foreground">
          Select a script from the queue to view or run its quality review.
        </p>
      </div>
    </div>
  )
}

function ReviewSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-28 rounded-lg" />
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="px-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex gap-3 border-b border-border py-3 last:border-0">
              <Skeleton className="mt-0.5 h-4 w-4 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function PendingReviewPanel({
  script,
  onRun,
  isRunning,
}: {
  script: ScriptWithHook
  onRun: () => void
  isRunning: boolean
}) {
  const clientExists = MOCK_CLIENTS.some(c => c.id === script.clientId)

  return (
    <div className="flex h-full items-center justify-center">
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">No review yet</p>
          <p className="text-xs text-muted-foreground">
            {clientExists
              ? 'Run the quality review agent on this script.'
              : 'Client context not found for this script.'}
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          disabled={isRunning || !clientExists}
          onClick={onRun}
        >
          {isRunning ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}
          {isRunning ? 'Reviewing…' : 'Run Quality Review'}
        </Button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function QualityCenterPage() {
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const {
    data: scripts = [],
    isLoading: scriptsLoading,
    isError: scriptsError,
    refetch: refetchScripts,
  } = useScripts()

  const reviewQuery = useReviewForScript(selectedScriptId)
  const reviewMutation = useRunQualityReview()

  const selectedScript = scripts.find(s => s.id === selectedScriptId) ?? null

  const countByStatus = useMemo(() => {
    const counts: Record<string, number> = { all: scripts.length }
    for (const s of scripts) {
      counts[s.status] = (counts[s.status] ?? 0) + 1
    }
    return counts
  }, [scripts])

  const filteredScripts = useMemo(() => {
    if (statusFilter === 'all') return scripts
    return scripts.filter(s => s.status === statusFilter)
  }, [scripts, statusFilter])

  const handleRunReview = (script: ScriptWithHook) => {
    const clientContext = MOCK_CLIENTS.find(c => c.id === script.clientId)
    if (!clientContext) return
    reviewMutation.mutate({ scriptId: script.id, clientContext })
  }

  // ── Right panel render ──────────────────────────────────────────────────────

  const isCurrentlyReviewing =
    reviewMutation.isPending && reviewMutation.variables?.scriptId === selectedScriptId

  const rightPanel = (() => {
    if (!selectedScriptId || !selectedScript) return <EmptyRightPanel />

    if (reviewQuery.isLoading || isCurrentlyReviewing) return <ReviewSkeleton />

    const review = reviewQuery.data ?? null

    if (!review && selectedScript.status === 'pending_review') {
      return (
        <PendingReviewPanel
          script={selectedScript}
          onRun={() => handleRunReview(selectedScript)}
          isRunning={false}
        />
      )
    }

    if (!review) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="space-y-3 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Review data unavailable.</p>
            <Button size="sm" variant="outline" onClick={() => void reviewQuery.refetch()}>
              Retry
            </Button>
          </div>
        </div>
      )
    }

    return <ReviewPanel review={review} />
  })()

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-6 py-5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Quality Center</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Inspect 10-criteria quality reports and manage held scripts.
        </p>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel ────────────────────────────────────────────── */}
        <div className="flex w-80 shrink-0 flex-col border-r border-border">

          {/* Status filter tabs */}
          <div className="shrink-0 border-b border-border p-2">
            <div className="flex gap-1">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors',
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
          </div>

          {/* Script list */}
          <div className="flex-1 overflow-y-auto">

            {/* Loading */}
            {scriptsLoading && (
              <div>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-2 border-b border-border px-4 py-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-20 rounded-full" />
                      <Skeleton className="h-3 w-10" />
                    </div>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {scriptsError && (
              <div className="flex flex-col items-center gap-3 p-6 text-center">
                <AlertCircle className="h-6 w-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Failed to load scripts.</p>
                <Button size="sm" variant="outline" onClick={() => void refetchScripts()}>
                  Retry
                </Button>
              </div>
            )}

            {/* Empty — no scripts at all */}
            {!scriptsLoading && !scriptsError && scripts.length === 0 && (
              <div className="flex flex-col items-center gap-2 p-6 text-center">
                <ShieldCheck className="h-8 w-8 text-muted-foreground" />
                <p className="text-xs font-medium text-foreground">No scripts yet</p>
                <p className="text-[11px] text-muted-foreground">
                  Generate scripts in Content Studio first.
                </p>
              </div>
            )}

            {/* Empty — filter has no results */}
            {!scriptsLoading &&
              !scriptsError &&
              scripts.length > 0 &&
              filteredScripts.length === 0 && (
                <div className="p-6 text-center">
                  <p className="text-xs text-muted-foreground">
                    No {statusFilter.replace('_', ' ')} scripts.
                  </p>
                </div>
              )}

            {/* Script queue items */}
            {filteredScripts.map(script => {
              const isSelected = script.id === selectedScriptId

              return (
                <button
                  key={script.id}
                  className={cn(
                    'w-full border-b border-border border-l-2 border-l-transparent px-4 py-3 text-left transition-colors hover:bg-muted/40',
                    isSelected && 'border-l-primary bg-primary/5',
                  )}
                  onClick={() => setSelectedScriptId(script.id)}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <StatusBadge status={script.status} className="text-[10px]" />
                    <span className="shrink-0 text-[10px] text-muted-foreground/50">
                      {relativeTime(script.createdAt)}
                    </span>
                  </div>
                  <p className="mb-1 line-clamp-2 text-sm font-medium leading-snug text-foreground">
                    {script.ideaHookLine}
                  </p>
                  <span className="font-mono text-[11px] text-muted-foreground/60">
                    {script.pipelineRunId.slice(0, 10)}…
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Right panel ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">{rightPanel}</div>
      </div>
    </div>
  )
}
