import {
  GitBranch,
  Lightbulb,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  ClipboardList,
  CheckCircle,
  PauseCircle,
  BarChart3,
  UserCheck,
  ShieldCheck,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  Circle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { m } from 'motion/react'
import { PageContainer } from '@/components/PageContainer'
import { SectionHeader } from '@/components/SectionHeader'
import { StatCard } from '@/components/StatCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useDashboardSummary } from '@/hooks/use-dashboard-summary'
import { containerVariants, itemVariants } from '@/lib/animations'
import type { DashboardSummary } from '@/types'

// ── Skeleton ──────────────────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
      <Skeleton className="h-8 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  )
}

function StatGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  )
}

// ── Stat configs ──────────────────────────────────────────────────────────────

interface StatConfig {
  key: keyof DashboardSummary
  label: string
  icon: LucideIcon
  description: string
}

const pipelineStats: StatConfig[] = [
  { key: 'pipelines',        label: 'Pipeline Runs',      icon: GitBranch,  description: 'Total runs completed' },
  { key: 'ideasGenerated',   label: 'Ideas Generated',    icon: Lightbulb,  description: 'Across all pipeline runs' },
  { key: 'scriptsGenerated', label: 'Scripts Generated',  icon: FileText,   description: 'From approved ideas' },
]

const ideaStats: StatConfig[] = [
  { key: 'pendingIdeas',  label: 'Pending Approval', icon: Clock,        description: 'Awaiting human review' },
  { key: 'approvedIdeas', label: 'Approved Ideas',   icon: CheckCircle2, description: 'Ready for scripting' },
  { key: 'rejectedIdeas', label: 'Rejected Ideas',   icon: XCircle,      description: 'Not selected for scripting' },
]

const reviewStats: StatConfig[] = [
  { key: 'pendingReviews', label: 'Pending Review',  icon: ClipboardList, description: 'Awaiting quality review' },
  { key: 'passedReviews',  label: 'Passed Quality',  icon: CheckCircle,   description: 'Cleared for delivery' },
  { key: 'heldReviews',    label: 'Scripts on Hold', icon: PauseCircle,   description: 'Flagged by quality review' },
]

// ── Workflow Snapshot ─────────────────────────────────────────────────────────

interface WorkflowStep {
  icon: LucideIcon
  name: string
  description: string
}

const workflowSteps: WorkflowStep[] = [
  { icon: Lightbulb,   name: 'Idea Agent',      description: 'Generates creative hooks and angles from client context' },
  { icon: BarChart3,   name: 'ICE Scoring',     description: 'Scores ideas by Impact, Confidence, and Ease' },
  { icon: UserCheck,   name: 'Human Approval',  description: 'Ideas reviewed and approved before scripting' },
  { icon: FileText,    name: 'Script Agent',    description: 'Transforms approved ideas into full video scripts' },
  { icon: ShieldCheck, name: 'Quality Review',  description: 'Evaluates scripts across 10 quality criteria' },
]

function WorkflowSnapshot() {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
        Workflow Snapshot
      </p>
      <div className="flex items-start gap-1">
        {workflowSteps.map((step, index) => (
          <div key={step.name} className="flex items-start gap-1 flex-1 min-w-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-3 mb-2">
                <step.icon className="h-4 w-4 shrink-0 text-primary" />
                <span className="text-xs font-medium text-foreground truncate">{step.name}</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed text-center px-1">
                {step.description}
              </p>
            </div>
            {index < workflowSteps.length - 1 && (
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40 mt-3" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── System Health ─────────────────────────────────────────────────────────────

interface HealthItem { label: string; value: string }

const healthItems: HealthItem[] = [
  { label: 'AI Provider', value: 'Google Gemini' },
  { label: 'Model',       value: 'gemini-2.5-flash' },
  { label: 'Database',    value: 'SQLite (libsql)' },
  { label: 'Status',      value: 'All Systems' },
]

function SystemHealth() {
  return (
    <div className="rounded-lg border border-border bg-card p-5 h-full">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
        System Health
      </p>
      <div className="space-y-3">
        {healthItems.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{item.label}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-foreground">{item.value}</span>
              <Circle className="h-2 w-2 fill-green-500 text-green-500" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <Circle className="h-2 w-2 fill-green-500 text-green-500" />
          <span className="text-xs font-medium text-green-500">Operational</span>
        </div>
      </div>
    </div>
  )
}

// ── Error state ───────────────────────────────────────────────────────────────

function StatsError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
        <AlertCircle className="h-5 w-5 text-destructive" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Failed to load dashboard</p>
        <p className="text-xs text-muted-foreground max-w-xs">{message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </Button>
    </div>
  )
}

// ── Stat section ──────────────────────────────────────────────────────────────
// Each section staggers its three StatCards in with containerVariants.

function StatSection({
  label,
  configs,
  data,
}: {
  label: string
  configs: StatConfig[]
  data: DashboardSummary
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <m.div
        className="grid grid-cols-3 gap-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {configs.map((config) => (
          <m.div key={config.key} variants={itemVariants}>
            <StatCard
              label={config.label}
              value={data[config.key]}
              icon={config.icon}
              description={config.description}
            />
          </m.div>
        ))}
      </m.div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function OverviewPage() {
  const { data, isLoading, isError, error, refetch } = useDashboardSummary()

  const errorMessage =
    isError && error instanceof Object && 'message' in error
      ? String((error as { message: string }).message)
      : 'An unexpected error occurred'

  return (
    <PageContainer>
      <div className="space-y-8">
        <SectionHeader
          title="Overview"
          description="Monitor your AI content production pipeline."
        />

        {/* Stat Cards */}
        <div className="space-y-6">
          {isLoading ? (
            <div className="space-y-6">
              <StatGridSkeleton count={3} />
              <StatGridSkeleton count={3} />
              <StatGridSkeleton count={3} />
            </div>
          ) : isError ? (
            <StatsError message={errorMessage} onRetry={refetch} />
          ) : data ? (
            <div className="space-y-6">
              <StatSection label="Pipeline"        configs={pipelineStats} data={data} />
              <StatSection label="Idea Breakdown"  configs={ideaStats}     data={data} />
              <StatSection label="Review Status"   configs={reviewStats}   data={data} />
            </div>
          ) : null}
        </div>

        {/* Static panels */}
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2"><WorkflowSnapshot /></div>
          <div className="col-span-1"><SystemHealth /></div>
        </div>
      </div>
    </PageContainer>
  )
}
