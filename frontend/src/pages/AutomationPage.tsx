import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Lightbulb,
  BarChart3,
  UserCheck,
  FileText,
  ShieldCheck,
  Database,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Clock,
  Layers,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { m, AnimatePresence } from 'motion/react'
import { PageContainer } from '@/components/PageContainer'
import { SectionHeader } from '@/components/SectionHeader'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { containerVariants, itemVariants } from '@/lib/animations'
import { useRunPipeline } from '@/hooks/use-run-pipeline'
import { PipelineError } from '@/services/pipeline.service'
import { MOCK_CLIENTS } from '@/data/mock-clients'
import { MemoryExplorer } from '@/components/MemoryExplorer'

// ── Stage definitions ─────────────────────────────────────────────────────────

type StageStatus = 'idle' | 'waiting' | 'running' | 'complete' | 'queued' | 'error'

interface Stage {
  key: string
  name: string
  description: string
  icon: LucideIcon
  automated: boolean
}

const STAGES: Stage[] = [
  { key: 'IdeaGeneration', name: 'Idea Agent',             description: 'Generates creative hooks and angles from your client context', icon: Lightbulb,  automated: true },
  { key: 'IceScoring',     name: 'ICE Scoring Agent',      description: 'Scores each idea on Impact, Confidence, and Ease',            icon: BarChart3,  automated: true },
  { key: 'Persistence',    name: 'SQLite',                 description: 'Persists scored ideas to the database',                       icon: Database,   automated: true },
  { key: 'ApprovalQueue',  name: 'Approval Queue',         description: 'Ideas reviewed and approved or rejected by a human',          icon: UserCheck,  automated: false },
  { key: 'ScriptAgent',    name: 'Script Agent',           description: 'Transforms approved ideas into full video scripts',           icon: FileText,   automated: false },
  { key: 'QualityReview',  name: 'Quality Review Agent',   description: 'Evaluates scripts across 10 quality criteria',               icon: ShieldCheck, automated: false },
]

const FAILED_STAGE_INDEX: Record<string, number> = {
  IdeaGeneration: 0,
  IceScoring: 1,
  Persistence: 2,
}

// ── Status config ─────────────────────────────────────────────────────────────

interface StatusStyle {
  dot: string
  line: string
  badge: string
  label: string
}

const STATUS_STYLES: Record<StageStatus, StatusStyle> = {
  idle:     { dot: 'bg-border',      line: 'bg-border',         badge: 'bg-muted text-muted-foreground',                              label: 'Idle' },
  waiting:  { dot: 'bg-border',      line: 'bg-border',         badge: 'bg-muted text-muted-foreground',                              label: 'Waiting' },
  running:  { dot: 'bg-primary',     line: 'bg-primary/30',     badge: 'bg-primary/10 text-primary border border-primary/20',        label: 'Running' },
  complete: { dot: 'bg-green-500',   line: 'bg-green-500/30',   badge: 'bg-green-500/10 text-green-400 border border-green-500/20',  label: 'Complete' },
  queued:   { dot: 'bg-yellow-500',  line: 'bg-yellow-500/30',  badge: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20', label: 'Queued' },
  error:    { dot: 'bg-destructive', line: 'bg-destructive/30', badge: 'bg-red-500/10 text-red-400 border border-red-500/20',        label: 'Failed' },
}

// ── Stage row ─────────────────────────────────────────────────────────────────

interface StageRowProps {
  stage: Stage
  status: StageStatus
  isLast: boolean
}

function StageRow({ stage, status, isLast }: StageRowProps) {
  const style = STATUS_STYLES[status]

  return (
    <div className="flex gap-4">
      {/* Indicator column */}
      <div className="flex flex-col items-center">
        {/* Dot — glow ring when running */}
        <div className="relative mt-1 shrink-0">
          {status === 'running' && (
            <m.div
              className="absolute inset-0 rounded-full bg-primary/20"
              animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          <div
            className={cn(
              'h-2.5 w-2.5 rounded-full transition-colors duration-500',
              style.dot,
            )}
          />
        </div>
        {!isLast && (
          <m.div
            className={cn('w-px mt-1.5 transition-colors duration-500', style.line)}
            style={{ flex: 1 }}
            initial={status === 'running' ? { scaleY: 0, originY: '0%' } : false}
            animate={{ scaleY: 1 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        )}
      </div>

      {/* Content */}
      <div className={cn('flex flex-1 items-start justify-between pb-6 min-w-0', isLast && 'pb-0')}>
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={cn(
              'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors duration-500',
              status === 'complete' || status === 'running' ? 'bg-primary/10'
                : status === 'error' ? 'bg-destructive/10'
                : status === 'queued' ? 'bg-yellow-500/10'
                : 'bg-muted',
            )}
          >
            {status === 'complete' ? (
              <m.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <CheckCircle2 className="h-4 w-4 text-green-400" />
              </m.div>
            ) : status === 'running' ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <stage.icon
                className={cn(
                  'h-4 w-4 transition-colors duration-500',
                  status === 'error'   ? 'text-destructive'
                    : status === 'queued' ? 'text-yellow-400'
                    : 'text-muted-foreground',
                )}
              />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">{stage.name}</p>
              {!stage.automated && (
                <span className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider">
                  manual
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{stage.description}</p>
          </div>
        </div>

        {/* Status badge */}
        <m.span
          key={status}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'ml-4 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
            style.badge,
          )}
        >
          {style.label}
        </m.span>
      </div>
    </div>
  )
}

// ── Pipeline stages component ─────────────────────────────────────────────────

function PipelineStages({ statuses }: { statuses: StageStatus[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-6">
        Pipeline Stages
      </p>
      <m.div
        className="space-y-0"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {STAGES.map((stage, index) => (
          <m.div key={stage.key} variants={itemVariants}>
            <StageRow
              stage={stage}
              status={statuses[index] ?? 'idle'}
              isLast={index === STAGES.length - 1}
            />
          </m.div>
        ))}
      </m.div>
    </div>
  )
}

// ── Results panel ─────────────────────────────────────────────────────────────

interface ResultsPanelProps {
  pipelineRunId: string
  totalMs: number
  summary: { totalIdeas: number; approvedCandidates: number; considerCandidates: number; rejectedCandidates: number }
  onRunAgain: () => void
  onViewIdeas: () => void
}

function ResultsPanel({ pipelineRunId, totalMs, summary, onRunAgain, onViewIdeas }: ResultsPanelProps) {
  const durationSec = (totalMs / 1000).toFixed(1)
  const runIdShort = pipelineRunId.slice(0, 8)

  return (
    <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-400" />
        <p className="text-sm font-medium text-green-400">Pipeline Complete</p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Pipeline ID</span>
          <span className="font-mono text-xs text-foreground">{runIdShort}…</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Duration
          </span>
          <span className="text-xs font-medium text-foreground">{durationSec}s</span>
        </div>
      </div>

      <div className="border-t border-border pt-3 space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Ideas</p>
        {[
          { label: 'Total',    value: summary.totalIdeas },
          { label: 'Approve',  value: summary.approvedCandidates },
          { label: 'Consider', value: summary.considerCandidates },
          { label: 'Reject',   value: summary.rejectedCandidates },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-xs font-semibold text-foreground">{value}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={onViewIdeas}>
          <ArrowRight className="h-3.5 w-3.5" />
          View Ideas
        </Button>
        <Button variant="ghost" size="sm" className="flex-1 gap-1.5" onClick={onRunAgain}>
          <RefreshCw className="h-3.5 w-3.5" />
          Run Again
        </Button>
      </div>
    </div>
  )
}

// ── Error panel ───────────────────────────────────────────────────────────────

function ErrorPanel({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const failedStage =
    error instanceof PipelineError && error.failedStage ? error.failedStage : null

  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-destructive" />
        <p className="text-sm font-medium text-destructive">Pipeline Failed</p>
      </div>

      {failedStage && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Failed Stage</span>
          <span className="text-xs font-medium text-foreground">{failedStage}</span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{error.message}</p>

      <Button variant="outline" size="sm" className="w-full gap-1.5" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </Button>
    </div>
  )
}

// ── Animated panel wrapper ────────────────────────────────────────────────────

function SlidingPanel({ children }: { children: React.ReactNode }) {
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </m.div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AutomationPage() {
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [activeStageIdx, setActiveStageIdx] = useState(0)
  const mutation = useRunPipeline()
  const navigate = useNavigate()

  const selectedClient = MOCK_CLIENTS.find((c) => c.id === selectedClientId) ?? null

  useEffect(() => {
    if (!mutation.isPending) return
    setActiveStageIdx(0)
    const t1 = setTimeout(() => setActiveStageIdx(1), 5_000)
    const t2 = setTimeout(() => setActiveStageIdx(2), 10_000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [mutation.isPending])

  const stageStatuses = useMemo<StageStatus[]>(() => {
    if (mutation.isPending) {
      return STAGES.map((_, i): StageStatus => (i <= activeStageIdx ? 'running' : 'waiting'))
    }
    if (mutation.isSuccess) {
      return STAGES.map((_, i): StageStatus => {
        if (i < 3) return 'complete'
        if (i === 3) return 'queued'
        return 'waiting'
      })
    }
    if (mutation.isError) {
      const failedIdx =
        mutation.error instanceof PipelineError && mutation.error.failedStage !== null
          ? (FAILED_STAGE_INDEX[mutation.error.failedStage] ?? 0)
          : 0
      return STAGES.map((_, i): StageStatus => {
        if (i < failedIdx) return 'complete'
        if (i === failedIdx) return 'error'
        return 'waiting'
      })
    }
    return STAGES.map((): StageStatus => 'idle')
  }, [mutation.isPending, mutation.isSuccess, mutation.isError, mutation.error, activeStageIdx])

  const handleRun = () => {
    if (!selectedClient) return
    mutation.mutate(selectedClient)
  }

  const handleRunAgain = () => mutation.reset()
  const canRun = selectedClient !== null && !mutation.isPending

  return (
    <PageContainer className="max-w-5xl">
      <div className="space-y-8">
        <SectionHeader
          title="Automation"
          description="Launch a complete AI content generation pipeline."
        />

        <div className="grid grid-cols-[1fr_360px] gap-6 items-start">
          {/* ── Pipeline stages ─────────────────────────────────────────── */}
          <PipelineStages statuses={stageStatuses} />

          {/* ── Control panel ────────────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-5 space-y-5">
              {/* Client selector */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Client
                </label>
                <Select
                  value={selectedClientId}
                  onValueChange={setSelectedClientId}
                  disabled={mutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client…" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOCK_CLIENTS.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedClient && (
                  <p className="text-xs text-muted-foreground truncate">{selectedClient.niche}</p>
                )}
              </div>

              <div className="h-px bg-border" />

              {/* Run button */}
              <m.div whileTap={canRun ? { scale: 0.98 } : undefined}>
                <Button
                  className="w-full gap-2"
                  onClick={handleRun}
                  disabled={!canRun}
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Running…
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Run Pipeline
                    </>
                  )}
                </Button>
              </m.div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Layers className="h-3.5 w-3.5" />
                <span>3 automated stages · 2 AI calls</span>
              </div>
            </div>

            {/* Animated result / error panels */}
            <AnimatePresence mode="wait">
              {mutation.isSuccess && mutation.data && (
                <SlidingPanel key="results">
                  <ResultsPanel
                    pipelineRunId={mutation.data.pipelineRunId}
                    totalMs={mutation.data.timings.totalMs}
                    summary={mutation.data.summary}
                    onRunAgain={handleRunAgain}
                    onViewIdeas={() => navigate('/ideas')}
                  />
                </SlidingPanel>
              )}
              {mutation.isError && mutation.error && (
                <SlidingPanel key="error">
                  <ErrorPanel error={mutation.error} onRetry={handleRun} />
                </SlidingPanel>
              )}
            </AnimatePresence>

            {/* Memory Explorer */}
            {selectedClient && (
              <MemoryExplorer key={selectedClient.id} client={selectedClient} />
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
