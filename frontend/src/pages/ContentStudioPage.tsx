import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePagination } from '@/hooks/use-pagination'
import { Pagination } from '@/components/ui/pagination'
import {
  Search,
  Copy,
  Check,
  Loader2,
  FileText,
  Sparkles,
  AlertCircle,
  BookOpen,
  Lightbulb,
  ShieldCheck,
  MousePointerClick,
  Clock,
  Camera,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { m, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { cn } from '@/lib/utils'
import { containerVariants, itemVariants } from '@/lib/animations'
import { useApprovedIdeas } from '@/hooks/use-approved-ideas'
import { useScripts } from '@/hooks/use-scripts'
import { useScriptForIdea } from '@/hooks/use-script-for-idea'
import { useGenerateScript } from '@/hooks/use-generate-script'
import { useClients } from '@/hooks/use-clients'
import type { Idea, Script } from '@/types'

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

function spokenWordCount(script: Script): number {
  return [script.hook1, script.body.problem, script.body.story,
          script.body.solution, script.body.proof, script.body.cta]
    .join(' ').trim().split(/\s+/).filter(Boolean).length
}

function durationStr(wordCount: number): string {
  const secs = Math.round((wordCount / 140) * 60)
  if (secs < 60) return `~${secs}s`
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `~${m}m${s > 0 ? ` ${s}s` : ''}`
}

function buildScriptText(script: Script): string {
  return [
    '=== Hook Variations ===',
    `Hook 1: ${script.hook1}`,
    `Hook 2: ${script.hook2}`,
    `Hook 3: ${script.hook3}`,
    '',
    '=== Problem ===',   script.body.problem,
    '',
    '=== Story ===',     script.body.story,
    '',
    '=== Solution ===',  script.body.solution,
    '',
    '=== Proof ===',     script.body.proof,
    '',
    '=== Call to Action ===', script.body.cta,
  ].join('\n')
}

// ── Copy button with "✓ Copied" inline feedback ───────────────────────────────

interface CopyButtonProps {
  text: string
  label: string
  size?: 'icon' | 'sm'
  className?: string
}

function CopyButton({ text, label, size = 'icon', className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(
      () => {
        toast.success(`${label} copied.`)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      },
      () => toast.error('Copy failed.'),
    )
  }

  if (size === 'sm') {
    return (
      <Button
        size="sm"
        variant="ghost"
        className={cn('h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground min-w-20', className)}
        onClick={handleCopy}
      >
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <m.span
              key="copied"
              className="flex items-center gap-1.5"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Check className="h-3 w-3 text-green-400" />
              <span className="text-green-400">Copied</span>
            </m.span>
          ) : (
            <m.span
              key="copy"
              className="flex items-center gap-1.5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
            >
              <Copy className="h-3 w-3" />
              Copy All
            </m.span>
          )}
        </AnimatePresence>
      </Button>
    )
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      className={cn('h-7 w-7 text-muted-foreground hover:text-foreground', className)}
      onClick={handleCopy}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <m.span
            key="copied"
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <Check className="h-3.5 w-3.5 text-green-400" />
          </m.span>
        ) : (
          <m.span
            key="copy"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <Copy className="h-3.5 w-3.5" />
          </m.span>
        )}
      </AnimatePresence>
    </Button>
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────

const REC_CLASS: Record<string, string> = {
  APPROVE:  'bg-green-500/10 text-green-400 border-green-500/20',
  CONSIDER: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  REJECT:   'bg-red-500/10 text-red-400 border-red-500/20',
}

interface BodySection {
  key: keyof Script['body']
  label: string
  icon: LucideIcon
}

const BODY_SECTIONS: BodySection[] = [
  { key: 'problem',  label: 'Problem',       icon: AlertCircle },
  { key: 'story',    label: 'Story',          icon: BookOpen },
  { key: 'solution', label: 'Solution',       icon: Lightbulb },
  { key: 'proof',    label: 'Proof',          icon: ShieldCheck },
  { key: 'cta',      label: 'Call to Action', icon: MousePointerClick },
]

// ── Script section card ───────────────────────────────────────────────────────

function ScriptSectionCard({
  label,
  icon: Icon,
  content,
  pacing,
  visual,
}: {
  label: string
  icon: LucideIcon
  content: string
  pacing?: string
  visual?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
        </div>
        <CopyButton text={content} label={label} />
      </div>
      <div className="px-4 py-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{content}</p>
        {(pacing || visual) && (
          <div className="mt-3 space-y-1.5 border-t border-border/50 pt-3">
            {pacing && (
              <div className="flex items-start gap-1.5">
                <Clock className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/50" />
                <span className="text-xs text-muted-foreground">{pacing}</span>
              </div>
            )}
            {visual && (
              <div className="flex items-start gap-1.5">
                <Camera className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/50" />
                <span className="text-xs text-muted-foreground">{visual}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Script viewer ─────────────────────────────────────────────────────────────

function ScriptViewer({ idea, script }: { idea: Idea; script: Script }) {
  const wordCount = spokenWordCount(script)
  const hooksText = [
    `Hook 1: ${script.hook1}`,
    `Hook 2: ${script.hook2}`,
    `Hook 3: ${script.hook3}`,
  ].join('\n')

  return (
    <m.div
      className="space-y-4 px-6 py-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Script header */}
      <m.div variants={itemVariants} className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <p className="text-base font-semibold leading-snug text-foreground">{idea.hookLine}</p>
          <CopyButton
            text={buildScriptText(script)}
            label="Full script"
            size="sm"
            className="shrink-0"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            Pipeline{' '}
            <span className="font-mono text-[11px] text-foreground/60">
              {script.pipelineRunId.slice(0, 12)}…
            </span>
          </span>
          <span>·</span>
          <span>{new Date(script.createdAt).toLocaleString()}</span>
          <span>·</span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {durationStr(wordCount)} · {wordCount} words
          </span>
          <StatusBadge status={script.status} />
        </div>
      </m.div>

      {/* Hooks card */}
      <m.div variants={itemVariants} className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Hook Variations
            </span>
          </div>
          <CopyButton text={hooksText} label="Hook variations" size="sm" />
        </div>
        <div className="divide-y divide-border">
          {[script.hook1, script.hook2, script.hook3].map((hook, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 w-4 shrink-0 text-xs font-bold text-muted-foreground/50">
                {i + 1}
              </span>
              <p className="flex-1 text-sm leading-relaxed text-foreground/90">{hook}</p>
              <CopyButton text={hook} label={`Hook ${i + 1}`} />
            </div>
          ))}
        </div>
      </m.div>

      {/* Body sections */}
      {BODY_SECTIONS.map(({ key, label, icon }) => (
        <m.div key={key} variants={itemVariants}>
          <ScriptSectionCard
            label={label}
            icon={icon}
            content={script.body[key]}
            pacing={script.sectionPacing?.[key] ?? undefined}
            visual={script.sectionVisuals?.[key] ?? undefined}
          />
        </m.div>
      ))}
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
          <FileText className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">No idea selected</p>
        <p className="max-w-55 text-xs text-muted-foreground">
          Select an approved idea to generate or view its script.
        </p>
      </m.div>
    </div>
  )
}

function ScriptLoadingSkeleton() {
  return (
    <div className="space-y-4 px-6 py-6">
      <div className="space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3.5 w-2/5" />
      </div>
      <Skeleton className="h-36 rounded-lg" />
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-28 rounded-lg" />
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-20 rounded-lg" />
    </div>
  )
}

function NoScriptPanel({
  onGenerate,
  isGenerating,
  clientExists,
}: {
  onGenerate: () => void
  isGenerating: boolean
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
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">No script yet</p>
          <p className="text-xs text-muted-foreground">
            {clientExists
              ? 'Generate a script for this approved idea.'
              : 'Client context not found for this idea.'}
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          disabled={isGenerating || !clientExists}
          onClick={onGenerate}
        >
          {isGenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          {isGenerating ? 'Generating…' : 'Generate Script'}
        </Button>
      </m.div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ContentStudioPage() {
  const navigate = useNavigate()
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const {
    data: approvedIdeas = [],
    isLoading: ideasLoading,
    isError: ideasError,
    refetch: refetchIdeas,
  } = useApprovedIdeas()

  const { data: scripts = [] } = useScripts()
  const { data: clients = [] } = useClients()

  const scriptQuery      = useScriptForIdea(selectedIdeaId)
  const generateMutation = useGenerateScript()

  const selectedIdea = approvedIdeas.find(i => i.id === selectedIdeaId) ?? null

  const generatedIdeaIds = useMemo(
    () => new Set(scripts.map(s => s.ideaId)),
    [scripts],
  )

  const filteredIdeas = useMemo(() => {
    if (!search.trim()) return approvedIdeas
    const q = search.toLowerCase()
    return approvedIdeas.filter(
      i => i.hookLine.toLowerCase().includes(q) || i.targetAvatar.toLowerCase().includes(q),
    )
  }, [approvedIdeas, search])

  const PAGE_SIZE = 10
  const { page, setPage, totalPages, pageItems: ideaPage } = usePagination(filteredIdeas, PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, setPage])

  const handleSelect   = (idea: Idea) => setSelectedIdeaId(idea.id)

  const handleGenerate = (idea: Idea) => {
    setSelectedIdeaId(idea.id)
    const clientContext = clients.find(c => c.id === idea.clientId)
    if (!clientContext) return
    generateMutation.mutate({ ideaId: idea.id, clientContext })
  }

  const isCurrentlyGenerating =
    generateMutation.isPending && generateMutation.variables?.ideaId === selectedIdeaId

  const rightPanel = (() => {
    if (!selectedIdeaId || !selectedIdea) return <EmptyRightPanel />
    if (scriptQuery.isLoading || isCurrentlyGenerating) return <ScriptLoadingSkeleton />
    const script = scriptQuery.data ?? null
    if (script === null) {
      return (
        <NoScriptPanel
          onGenerate={() => handleGenerate(selectedIdea)}
          isGenerating={false}
          clientExists={clients.some(c => c.id === selectedIdea.clientId)}
        />
      )
    }
    return <ScriptViewer idea={selectedIdea} script={script} />
  })()

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-6 py-5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Content Studio</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Generate and review AI-written marketing scripts.
        </p>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel ────────────────────────────────────────────── */}
        <div className="flex w-85 shrink-0 flex-col border-r border-border">
          <div className="shrink-0 border-b border-border p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search ideas…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {ideasLoading && (
              <div>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-2 border-b border-border px-4 py-3">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-7 w-full rounded-md" />
                  </div>
                ))}
              </div>
            )}

            {ideasError && (
              <div className="flex flex-col items-center gap-3 p-6 text-center">
                <AlertCircle className="h-6 w-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Failed to load approved ideas.</p>
                <Button size="sm" variant="outline" onClick={() => void refetchIdeas()}>Retry</Button>
              </div>
            )}

            {!ideasLoading && !ideasError && approvedIdeas.length === 0 && (
              <div className="flex flex-col items-center gap-3 p-6 text-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">No approved ideas</p>
                  <p className="text-[11px] text-muted-foreground">
                    Approve ideas in Idea Intelligence first.
                  </p>
                </div>
                <Button size="sm" variant="outline" className="text-xs" onClick={() => navigate('/ideas')}>
                  Go to Idea Intelligence
                </Button>
              </div>
            )}

            {!ideasLoading && !ideasError && approvedIdeas.length > 0 && filteredIdeas.length === 0 && (
              <div className="p-6 text-center">
                <p className="text-xs text-muted-foreground">No ideas match your search.</p>
              </div>
            )}

            {ideaPage.map(idea => {
              const isSelected  = idea.id === selectedIdeaId
              const hasScript   = generatedIdeaIds.has(idea.id)
              const isGenerating =
                generateMutation.isPending && generateMutation.variables?.ideaId === idea.id
              const clientExists = clients.some(c => c.id === idea.clientId)
              const rec = idea.iceScore?.recommendation ?? null

              return (
                <button
                  key={idea.id}
                  className={cn(
                    'w-full border-b border-border border-l-2 border-l-transparent px-4 py-3 text-left transition-colors hover:bg-muted/40',
                    isSelected && 'bg-primary/5 border-l-primary',
                  )}
                  onClick={() => handleSelect(idea)}
                >
                  <p className="mb-1.5 line-clamp-2 text-sm font-medium leading-snug text-foreground">
                    {idea.hookLine}
                  </p>
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <span className="truncate text-[11px] text-muted-foreground">{idea.targetAvatar}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {rec && (
                        <span className={cn('rounded-full border px-1.5 py-0.5 text-[10px] font-semibold', REC_CLASS[rec])}>
                          {rec}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground/50">{relativeTime(idea.createdAt)}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant={hasScript ? 'secondary' : 'default'}
                    className="h-7 w-full gap-1.5 text-xs"
                    disabled={isGenerating || !clientExists}
                    onClick={e => {
                      e.stopPropagation()
                      if (hasScript) handleSelect(idea)
                      else handleGenerate(idea)
                    }}
                  >
                    {isGenerating ? (
                      <><Loader2 className="h-3 w-3 animate-spin" />Generating…</>
                    ) : hasScript ? (
                      <><FileText className="h-3 w-3" />Open Script</>
                    ) : (
                      <><Sparkles className="h-3 w-3" />Generate Script</>
                    )}
                  </Button>
                </button>
              )
            })}
          </div>
          <Pagination
            compact
            page={page}
            totalPages={totalPages}
            total={filteredIdeas.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>

        {/* ── Right panel — transitions between states ───────────────── */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <m.div
              key={selectedIdeaId ?? 'empty'}
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
