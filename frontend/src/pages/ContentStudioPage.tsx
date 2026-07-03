import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Copy,
  Loader2,
  FileText,
  Sparkles,
  AlertCircle,
  BookOpen,
  Lightbulb,
  ShieldCheck,
  MousePointerClick,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { cn } from '@/lib/utils'
import { useApprovedIdeas } from '@/hooks/use-approved-ideas'
import { useScriptForIdea } from '@/hooks/use-script-for-idea'
import { useGenerateScript } from '@/hooks/use-generate-script'
import { MOCK_CLIENTS } from '@/data/mock-clients'
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

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copied.`),
    () => toast.error('Copy failed.'),
  )
}

function buildScriptText(script: Script): string {
  return [
    '=== Hook Variations ===',
    `Hook 1: ${script.hook1}`,
    `Hook 2: ${script.hook2}`,
    `Hook 3: ${script.hook3}`,
    '',
    '=== Problem ===',
    script.body.problem,
    '',
    '=== Story ===',
    script.body.story,
    '',
    '=== Solution ===',
    script.body.solution,
    '',
    '=== Proof ===',
    script.body.proof,
    '',
    '=== Call to Action ===',
    script.body.cta,
  ].join('\n')
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
}: {
  label: string
  icon: LucideIcon
  content: string
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
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => copy(content, label)}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="px-4 py-4">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {content}
        </p>
      </div>
    </div>
  )
}

// ── Script viewer ─────────────────────────────────────────────────────────────

function ScriptViewer({ idea, script }: { idea: Idea; script: Script }) {
  const hooksText = [
    `Hook 1: ${script.hook1}`,
    `Hook 2: ${script.hook2}`,
    `Hook 3: ${script.hook3}`,
  ].join('\n')

  return (
    <div className="space-y-4 px-6 py-6">
      {/* Script header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <p className="text-base font-semibold leading-snug text-foreground">
            {idea.hookLine}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 text-xs"
            onClick={() => copy(buildScriptText(script), 'Full script')}
          >
            <Copy className="h-3 w-3" />
            Copy All
          </Button>
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
          <StatusBadge status={script.status} />
        </div>
      </div>

      {/* Hooks card */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Hook Variations
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => copy(hooksText, 'Hook variations')}
          >
            <Copy className="h-3 w-3" />
            Copy All
          </Button>
        </div>
        <div className="divide-y divide-border">
          {[script.hook1, script.hook2, script.hook3].map((hook, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 w-4 shrink-0 text-xs font-bold text-muted-foreground/50">
                {i + 1}
              </span>
              <p className="flex-1 text-sm leading-relaxed text-foreground/90">{hook}</p>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => copy(hook, `Hook ${i + 1}`)}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Body sections */}
      {BODY_SECTIONS.map(({ key, label, icon }) => (
        <ScriptSectionCard
          key={key}
          label={label}
          icon={icon}
          content={script.body[key]}
        />
      ))}
    </div>
  )
}

// ── Right-panel states ────────────────────────────────────────────────────────

function EmptyRightPanel() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="space-y-3 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <FileText className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">No idea selected</p>
        <p className="max-w-55 text-xs text-muted-foreground">
          Select an approved idea to generate or view its script.
        </p>
      </div>
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
  idea,
  onGenerate,
  isGenerating,
}: {
  idea: Idea
  onGenerate: () => void
  isGenerating: boolean
}) {
  const clientExists = MOCK_CLIENTS.some(c => c.id === idea.clientId)

  return (
    <div className="flex h-full items-center justify-center">
      <div className="space-y-4 text-center">
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
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ContentStudioPage() {
  const navigate = useNavigate()
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null)
  const [knownScriptIds, setKnownScriptIds] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const {
    data: approvedIdeas = [],
    isLoading: ideasLoading,
    isError: ideasError,
    refetch: refetchIdeas,
  } = useApprovedIdeas()

  const scriptQuery = useScriptForIdea(selectedIdeaId)
  const generateMutation = useGenerateScript()

  const selectedIdea = approvedIdeas.find(i => i.id === selectedIdeaId) ?? null

  const filteredIdeas = useMemo(() => {
    if (!search.trim()) return approvedIdeas
    const q = search.toLowerCase()
    return approvedIdeas.filter(
      i =>
        i.hookLine.toLowerCase().includes(q) ||
        i.targetAvatar.toLowerCase().includes(q),
    )
  }, [approvedIdeas, search])

  // When the script query resolves with data, mark this idea as having a script
  useEffect(() => {
    if (selectedIdeaId && scriptQuery.data != null) {
      setKnownScriptIds(prev => new Set(prev).add(selectedIdeaId))
    }
  }, [selectedIdeaId, scriptQuery.data])

  const handleSelect = (idea: Idea) => setSelectedIdeaId(idea.id)

  const handleGenerate = (idea: Idea) => {
    setSelectedIdeaId(idea.id)
    const clientContext = MOCK_CLIENTS.find(c => c.id === idea.clientId)
    if (!clientContext) return
    generateMutation.mutate(
      { ideaId: idea.id, clientContext },
      { onSuccess: () => setKnownScriptIds(prev => new Set(prev).add(idea.id)) },
    )
  }

  // ── Right panel render ──────────────────────────────────────────────────────

  const isCurrentlyGenerating =
    generateMutation.isPending &&
    generateMutation.variables?.ideaId === selectedIdeaId

  const rightPanel = (() => {
    if (!selectedIdeaId || !selectedIdea) return <EmptyRightPanel />

    if (scriptQuery.isLoading || isCurrentlyGenerating) return <ScriptLoadingSkeleton />

    const script = scriptQuery.data ?? null
    if (script === null) {
      return (
        <NoScriptPanel
          idea={selectedIdea}
          onGenerate={() => handleGenerate(selectedIdea)}
          isGenerating={false}
        />
      )
    }

    return <ScriptViewer idea={selectedIdea} script={script} />
  })()

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-6 py-5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Content Studio
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Generate and review AI-written marketing scripts.
        </p>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel ────────────────────────────────────────────── */}
        <div className="flex w-85 shrink-0 flex-col border-r border-border">

          {/* Search bar */}
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

          {/* Idea list */}
          <div className="flex-1 overflow-y-auto">

            {/* Loading skeletons */}
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

            {/* Error */}
            {ideasError && (
              <div className="flex flex-col items-center gap-3 p-6 text-center">
                <AlertCircle className="h-6 w-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Failed to load approved ideas.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void refetchIdeas()}
                >
                  Retry
                </Button>
              </div>
            )}

            {/* No approved ideas */}
            {!ideasLoading && !ideasError && approvedIdeas.length === 0 && (
              <div className="flex flex-col items-center gap-3 p-6 text-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-foreground">
                    No approved ideas
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Approve ideas in Idea Intelligence first.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => navigate('/ideas')}
                >
                  Go to Idea Intelligence
                </Button>
              </div>
            )}

            {/* No search results */}
            {!ideasLoading &&
              !ideasError &&
              approvedIdeas.length > 0 &&
              filteredIdeas.length === 0 && (
                <div className="p-6 text-center">
                  <p className="text-xs text-muted-foreground">
                    No ideas match your search.
                  </p>
                </div>
              )}

            {/* Idea list items */}
            {filteredIdeas.map(idea => {
              const isSelected = idea.id === selectedIdeaId
              const hasScript = knownScriptIds.has(idea.id)
              const isGenerating =
                generateMutation.isPending &&
                generateMutation.variables?.ideaId === idea.id
              const clientExists = MOCK_CLIENTS.some(c => c.id === idea.clientId)
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
                    <span className="truncate text-[11px] text-muted-foreground">
                      {idea.targetAvatar}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {rec && (
                        <span
                          className={cn(
                            'rounded-full border px-1.5 py-0.5 text-[10px] font-semibold',
                            REC_CLASS[rec],
                          )}
                        >
                          {rec}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground/50">
                        {relativeTime(idea.createdAt)}
                      </span>
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
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Generating…
                      </>
                    ) : hasScript ? (
                      'Open Script'
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3" />
                        Generate Script
                      </>
                    )}
                  </Button>
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
