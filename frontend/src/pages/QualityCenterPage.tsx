import { useEffect, useRef, useState, useMemo } from 'react'
import { usePagination } from '@/hooks/use-pagination'
import { Pagination } from '@/components/ui/pagination'
import {
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react'
import { m, AnimatePresence, useReducedMotion } from 'motion/react'
import { animate } from 'motion'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { cn } from '@/lib/utils'
import { containerVariants, itemVariants } from '@/lib/animations'
import { useScripts } from '@/hooks/use-scripts'
import { useReviewForScript } from '@/hooks/use-review-for-script'
import { useRunQualityReview } from '@/hooks/use-run-quality-review'
import { useRegenerateScript } from '@/hooks/use-regenerate-script'
import { useClients } from '@/hooks/use-clients'
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

function scoreColor(score: number): string {
  if (score >= 7) return 'text-green-400'
  if (score >= 5) return 'text-yellow-400'
  return 'text-red-400'
}

function scoreBarColor(score: number): string {
  if (score >= 7) return 'bg-green-400'
  if (score >= 5) return 'bg-yellow-400'
  return 'bg-red-400'
}

function ringStrokeColor(score: number): string {
  if (score >= 80) return '#4ade80'
  if (score >= 65) return '#facc15'
  return '#f87171'
}

// ── Animated score counter ────────────────────────────────────────────────────

function AnimatedScore({ value, className }: { value: number; className?: string }) {
  const ref     = useRef<HTMLSpanElement>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!ref.current) return
    if (reduced) { ref.current.textContent = String(value); return }
    const ctrl = animate(0, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate(v) { if (ref.current) ref.current.textContent = String(Math.round(v)) },
    })
    return () => ctrl.stop()
  }, [value, reduced])

  return <span ref={ref} className={className}>{value}</span>
}

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const circleRef     = useRef<SVGCircleElement>(null)
  const reduced       = useReducedMotion()
  const radius        = 36
  const circumference = 2 * Math.PI * radius
  const targetOffset  = circumference - (score / 100) * circumference
  const color         = ringStrokeColor(score)

  useEffect(() => {
    if (!circleRef.current) return
    if (reduced) { circleRef.current.style.strokeDashoffset = String(targetOffset); return }
    const ctrl = animate(circumference, targetOffset, {
      duration: 1.1,
      ease: [0.22, 1, 0.36, 1],
      onUpdate(v) { if (circleRef.current) circleRef.current.style.strokeDashoffset = String(v) },
    })
    return () => ctrl.stop()
  }, [score, reduced, circumference, targetOffset])

  return (
    <div className="relative flex shrink-0 items-center justify-center">
      <svg width="88" height="88" viewBox="0 0 88 88" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="44" cy="44" r={radius} fill="none" strokeWidth="7" stroke="var(--border)" />
        <circle
          ref={circleRef}
          cx="44" cy="44" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatedScore value={score} className="text-2xl font-bold tabular-nums leading-none" />
        <span className="text-[10px] text-muted-foreground">/ 100</span>
      </div>
    </div>
  )
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

// What each check evaluates — shown under the check label so the user knows the basis
const CHECK_CRITERIA: Record<keyof QualityChecks, string> = {
  hookStrength:      'Does Hook 1 make the target avatar stop scrolling in the first 3 seconds?',
  problemClarity:    'Is the problem section specific enough that the viewer thinks "that\'s exactly my situation"?',
  storyFlow:         'Does the story bridge from problem to solution without feeling forced or generic?',
  solutionAlignment: 'Is the product introduced naturally — transformation promised without overselling?',
  proofAccuracy:     'Are all cited results, numbers, and names traceable to the proof bank exactly as stated?',
  ctaAlignment:      'Does the CTA match the approved action from offer mechanics and avoid generic phrases?',
  brandVoice:        'Does the entire script sound like this specific client — not a generic coaching script?',
  fabrication:       'Are there zero claims that cannot be verified against a specific proof bank entry?',
  length:            'Is the spoken word count within the 100–220 word target for a 45–90 second video?',
  structure:         'Does the script follow Problem → Story → Solution → Proof → CTA in the correct sequence?',
}

// Returns the script section the agent was reading when it scored each criterion
function getCheckExcerpt(key: keyof QualityChecks, script: ScriptWithHook): string | undefined {
  switch (key) {
    case 'hookStrength':      return script.hook1
    case 'problemClarity':    return script.body.problem
    case 'storyFlow':         return script.body.story
    case 'solutionAlignment': return script.body.solution
    case 'proofAccuracy':     return script.body.proof
    case 'ctaAlignment':      return script.body.cta
    case 'fabrication':       return script.body.proof
    default:                  return undefined
  }
}

// ── Check card ────────────────────────────────────────────────────────────────

function CheckCard({
  label,
  criteria,
  check,
  excerpt,
}: {
  label: string
  criteria: string
  check: QualityChecks[keyof QualityChecks]
  excerpt?: string
}) {
  const isScored = 'score' in check
  const score    = isScored ? (check as { score: number }).score : null

  return (
    <div
      className={cn(
        'space-y-3 rounded-lg border p-4',
        check.pass ? 'border-border bg-card' : 'border-red-500/20 bg-red-500/3',
      )}
    >
      {/* Header: icon + label + score or pass badge */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {check.pass
            ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-400" />
            : <XCircle       className="h-4 w-4 shrink-0 text-red-400" />
          }
          <span className="text-sm font-semibold text-foreground">{label}</span>
        </div>
        {score !== null ? (
          <span className={cn('shrink-0 text-sm font-bold tabular-nums', scoreColor(score))}>
            {score}/10
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

      {/* Score bar */}
      {score !== null && (
        <div className="h-1 overflow-hidden rounded-full bg-border">
          <m.div
            className={cn('h-full rounded-full', scoreBarColor(score))}
            initial={{ width: 0 }}
            animate={{ width: `${(score / 10) * 100}%` }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      )}

      {/* What this criterion evaluates */}
      <p className="text-[11px] italic leading-relaxed text-muted-foreground/60">{criteria}</p>

      {/* Relevant script excerpt — what the agent was reading when it scored this */}
      {excerpt && (
        <blockquote className="border-l-2 border-border pl-3">
          <p className="line-clamp-2 text-xs italic leading-relaxed text-foreground/50">
            "{excerpt}"
          </p>
        </blockquote>
      )}

      {/* Agent's finding */}
      <div className={cn('rounded-md p-3', check.pass ? 'bg-muted/40' : 'bg-red-500/5')}>
        <p className="text-xs leading-relaxed text-muted-foreground">{check.reason}</p>
      </div>
    </div>
  )
}

// ── Collapsible script preview ────────────────────────────────────────────────

const BODY_SECTION_LABELS: [keyof ScriptWithHook['body'], string][] = [
  ['problem',  'Problem'],
  ['story',    'Story'],
  ['solution', 'Solution'],
  ['proof',    'Proof'],
  ['cta',      'Call to Action'],
]

function ScriptPreview({ script }: { script: ScriptWithHook }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        className="flex w-full items-center justify-between px-4 py-3"
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Script Evaluated
        </span>
        {open
          ? <ChevronUp   className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        }
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <m.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="space-y-4 border-t border-border px-4 py-4">
              {/* Hooks */}
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                  Hook Variations
                </p>
                <div className="space-y-1.5">
                  {[script.hook1, script.hook2, script.hook3].map((h, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="mt-0.5 w-3 shrink-0 text-[10px] font-bold text-muted-foreground/40">
                        {i + 1}
                      </span>
                      <p className="text-xs leading-relaxed text-foreground/70">{h}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Body sections */}
              {BODY_SECTION_LABELS.map(([key, label]) => (
                <div key={key}>
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                    {label}
                  </p>
                  <p className="text-xs leading-relaxed text-foreground/70">{script.body[key]}</p>
                </div>
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Review panel ──────────────────────────────────────────────────────────────

function ReviewPanel({
  review,
  script,
  onRegenerate,
  isRegenerating,
}: {
  review: QualityReview
  script: ScriptWithHook
  onRegenerate: () => void
  isRegenerating: boolean
}) {
  const isPassed     = review.overallDecision === 'PASS'
  const failedChecks = CHECK_ENTRIES.filter(([key]) => !review.checks[key].pass)
  const passedChecks = CHECK_ENTRIES.filter(([key]) =>  review.checks[key].pass)

  return (
    <m.div
      className="space-y-4 p-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {/* Overall result */}
      <div
        className={cn(
          'rounded-lg border p-5',
          isPassed ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5',
        )}
      >
        <div className="flex items-center gap-5">
          <ScoreRing score={review.overallScore} />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-base font-semibold leading-snug text-foreground">
              {script.ideaHookLine}
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <StatusBadge status={review.overallDecision} />
              <span className="text-xs text-muted-foreground">
                {isPassed
                  ? 'All 10 checks passed — ready for delivery.'
                  : `${failedChecks.length} check${failedChecks.length !== 1 ? 's' : ''} failed — held for revision.`}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground/50">
              Reviewed {relativeTime(review.createdAt)}
            </p>
            {!isPassed && (
              <Button
                size="sm"
                variant="outline"
                className="w-fit gap-1.5"
                disabled={isRegenerating}
                onClick={onRegenerate}
              >
                {isRegenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {isRegenerating ? 'Regenerating…' : 'Regenerate Script'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Collapsible script — shows exactly what the agent evaluated */}
      <ScriptPreview script={script} />

      {/* Failed checks */}
      {failedChecks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-red-400">
              {failedChecks.length} Failed {failedChecks.length === 1 ? 'Check' : 'Checks'}
            </span>
          </div>
          <m.div
            className="space-y-3"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {failedChecks.map(([key, label]) => (
              <m.div key={key} variants={itemVariants}>
                <CheckCard
                  label={label}
                  criteria={CHECK_CRITERIA[key]}
                  check={review.checks[key]}
                  excerpt={getCheckExcerpt(key, script)}
                />
              </m.div>
            ))}
          </m.div>
        </div>
      )}

      {/* Passed checks */}
      {passedChecks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {passedChecks.length} Passed {passedChecks.length === 1 ? 'Check' : 'Checks'}
            </span>
          </div>
          <m.div
            className="space-y-3"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {passedChecks.map(([key, label]) => (
              <m.div key={key} variants={itemVariants}>
                <CheckCard
                  label={label}
                  criteria={CHECK_CRITERIA[key]}
                  check={review.checks[key]}
                  excerpt={getCheckExcerpt(key, script)}
                />
              </m.div>
            ))}
          </m.div>
        </div>
      )}
    </m.div>
  )
}

// ── Right-panel states ────────────────────────────────────────────────────────

function EmptyRightPanel() {
  return (
    <div className="flex h-full items-center justify-center">
      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="space-y-3 text-center"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <ShieldCheck className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">No script selected</p>
        <p className="max-w-56 text-xs text-muted-foreground">
          Select a script from the queue to view or run its quality review.
        </p>
      </m.div>
    </div>
  )
}

function ReviewSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-28 rounded-lg" />
      <Skeleton className="h-12 rounded-lg" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-10" />
            </div>
            <Skeleton className="h-1 w-full rounded-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}

function PendingReviewPanel({
  onRun,
  isRunning,
  clientExists,
}: {
  onRun: () => void
  isRunning: boolean
  clientExists: boolean
}) {

  return (
    <div className="flex h-full items-center justify-center">
      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="space-y-4 text-center"
      >
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
      </m.div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function QualityCenterPage() {
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter]         = useState<StatusFilter>('all')

  const {
    data: scripts = [],
    isLoading: scriptsLoading,
    isError: scriptsError,
    refetch: refetchScripts,
  } = useScripts()

  const { data: clients = [] } = useClients()
  const reviewQuery        = useReviewForScript(selectedScriptId)
  const reviewMutation     = useRunQualityReview()
  const regenerateMutation = useRegenerateScript()

  const selectedScript = scripts.find(s => s.id === selectedScriptId) ?? null

  const countByStatus = useMemo(() => {
    const counts: Record<string, number> = { all: scripts.length }
    for (const s of scripts) counts[s.status] = (counts[s.status] ?? 0) + 1
    return counts
  }, [scripts])

  const filteredScripts = useMemo(() => {
    if (statusFilter === 'all') return scripts
    return scripts.filter(s => s.status === statusFilter)
  }, [scripts, statusFilter])

  const PAGE_SIZE = 10
  const { page, setPage, totalPages, pageItems: scriptPage } = usePagination(filteredScripts, PAGE_SIZE)

  useEffect(() => { setPage(1) }, [statusFilter, setPage])

  const handleRunReview = (script: ScriptWithHook) => {
    const clientContext = clients.find(c => c.id === script.clientId)
    if (!clientContext) return
    reviewMutation.mutate({ scriptId: script.id, clientContext })
  }

  const isCurrentlyReviewing =
    reviewMutation.isPending && reviewMutation.variables?.scriptId === selectedScriptId

  const rightPanel = (() => {
    if (!selectedScriptId || !selectedScript) return <EmptyRightPanel />
    if (reviewQuery.isLoading || isCurrentlyReviewing) return <ReviewSkeleton />
    const review = reviewQuery.data ?? null
    if (!review && selectedScript.status === 'pending_review') {
      return (
        <PendingReviewPanel
          onRun={() => handleRunReview(selectedScript)}
          isRunning={false}
          clientExists={clients.some(c => c.id === selectedScript.clientId)}
        />
      )
    }
    if (!review) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="space-y-3 text-center">
            <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Review data unavailable.</p>
            <Button size="sm" variant="outline" onClick={() => void reviewQuery.refetch()}>Retry</Button>
          </div>
        </div>
      )
    }
    return (
      <ReviewPanel
        review={review}
        script={selectedScript}
        isRegenerating={
          regenerateMutation.isPending &&
          regenerateMutation.variables?.ideaId === selectedScript.ideaId
        }
        onRegenerate={() => {
          const clientContext = clients.find(c => c.id === selectedScript.clientId)
          if (!clientContext) return
          regenerateMutation.mutate(
            { ideaId: selectedScript.ideaId, clientContext },
            { onSuccess: (newScript) => setSelectedScriptId(newScript.id) },
          )
        }}
      />
    )
  })()

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

          <div className="flex-1 overflow-y-auto">
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

            {scriptsError && (
              <div className="flex flex-col items-center gap-3 p-6 text-center">
                <AlertCircle className="h-6 w-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Failed to load scripts.</p>
                <Button size="sm" variant="outline" onClick={() => void refetchScripts()}>Retry</Button>
              </div>
            )}

            {!scriptsLoading && !scriptsError && scripts.length === 0 && (
              <div className="flex flex-col items-center gap-2 p-6 text-center">
                <ShieldCheck className="h-8 w-8 text-muted-foreground" />
                <p className="text-xs font-medium text-foreground">No scripts yet</p>
                <p className="text-[11px] text-muted-foreground">
                  Generate scripts in Content Studio first.
                </p>
              </div>
            )}

            {!scriptsLoading && !scriptsError && scripts.length > 0 && filteredScripts.length === 0 && (
              <div className="p-6 text-center">
                <p className="text-xs text-muted-foreground">
                  No {statusFilter.replace('_', ' ')} scripts.
                </p>
              </div>
            )}

            {scriptPage.map(script => {
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

          <Pagination
            compact
            page={page}
            totalPages={totalPages}
            total={filteredScripts.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>

        {/* ── Right panel ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <m.div
              key={selectedScriptId ?? 'empty'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="h-full"
            >
              {rightPanel}
            </m.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
