import { useState, useRef, useEffect } from 'react'
import {
  Plus,
  Trash2,
  X,
  Check,
  Users,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react'
import { m, AnimatePresence } from 'motion/react'
import { PageContainer } from '@/components/PageContainer'
import { SectionHeader } from '@/components/SectionHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useClients } from '@/hooks/use-clients'
import { useCreateClient } from '@/hooks/use-create-client'
import { useUpdateClient } from '@/hooks/use-update-client'
import { useDeleteClient } from '@/hooks/use-delete-client'
import type { ClientContext, Avatar, ProofPoint } from '@/types'

// ── Empty form factory ─────────────────────────────────────────────────────────

type ClientForm = Omit<ClientContext, 'id'>

function emptyForm(): ClientForm {
  return {
    name: '',
    niche: '',
    portfolioSummary: '',
    referencePackPath: '',
    brandVoice: { tone: '', speakingStyle: '', doNotUse: [], referenceExamples: [] },
    avatars: [],
    proofBank: [],
    offerMechanics: { productName: '', price: '', guarantee: '', keyBenefits: [], cta: '' },
  }
}

function clientToForm(c: ClientContext): ClientForm {
  return {
    name: c.name,
    niche: c.niche,
    portfolioSummary: c.portfolioSummary,
    referencePackPath: c.referencePackPath,
    brandVoice: { ...c.brandVoice, doNotUse: [...c.brandVoice.doNotUse], referenceExamples: [...c.brandVoice.referenceExamples] },
    avatars: c.avatars.map(a => ({ ...a, pains: [...a.pains], desires: [...a.desires] })),
    proofBank: c.proofBank.map(p => ({ ...p })),
    offerMechanics: { ...c.offerMechanics, keyBenefits: [...c.offerMechanics.keyBenefits] },
  }
}

// ── Preset options ─────────────────────────────────────────────────────────────

const NICHE_OPTIONS = [
  'High-Ticket Business Coaching',
  'Fitness & Health Coaching',
  'Life Coaching & Mindset',
  'Real Estate Investing',
  'Online Courses & Education',
  'E-commerce & Retail',
  'Financial Coaching',
  'Career & Executive Coaching',
  'Relationship Coaching',
  'Social Media Marketing Agency',
  'Digital Marketing',
  'Sales Coaching',
  'Leadership & Management Coaching',
  'Parenting & Family Coaching',
]

const TONE_OPTIONS = [
  'Direct & No-Nonsense',
  'Conversational',
  'Authoritative',
  'Warm & Empathetic',
  'Bold & Challenging',
  'Inspirational',
  'Educational',
  'Professional & Polished',
  'Energetic & Motivational',
  'Calm & Measured',
]

const SPEAKING_STYLE_OPTIONS = [
  'Conversational Authority',
  'Storytelling & Narrative',
  'Data-Driven',
  'Direct Speaker-to-Camera',
  'Casual & Relatable',
  'Expert Educator',
  'High-Energy Coach',
  'Calm & Confident',
  'Socratic / Question-Led',
  'Raw & Unfiltered',
]

const AVATAR_NAME_OPTIONS = [
  'Overworked Professional',
  'Aspiring Entrepreneur',
  'Struggling Freelancer',
  'Ambitious Side-Hustler',
  'Burned-Out Employee',
  'New Coach / Consultant',
  'Scaling Business Owner',
  'Recent Graduate',
  'Career Pivoter',
  'Stay-at-Home Parent Returning to Work',
]

const PROOF_CONTENT_PLACEHOLDER: Record<ProofPoint['type'], string> = {
  result:      'e.g. Sarah went from $3K to $12K/month in 8 weeks after joining the program',
  testimonial: 'e.g. "I never believed I could do it — now I\'m fully booked every month." — James T.',
  statistic:   'e.g. 87% of clients hit 6 figures within their first 90 days in the program',
  case_study:  'e.g. Marcus, a former corporate manager, scaled his coaching practice to $35K/month in 5 months',
}

const PROOF_SOURCE_PLACEHOLDER: Record<ProofPoint['type'], string> = {
  result:      'e.g. Sarah M. — 1:1 coaching client',
  testimonial: 'e.g. James T. — Group program member',
  statistic:   'e.g. Internal cohort data, Jan–Mar 2024',
  case_study:  'e.g. Marcus V. — Case study (5-month engagement)',
}

// ── Combobox input ─────────────────────────────────────────────────────────────

function ComboboxInput({
  value,
  onChange,
  options,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = value.trim()
    ? options.filter(o => o.toLowerCase().includes(value.toLowerCase()))
    : options

  const showDropdown = open && filtered.length > 0

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}
        placeholder={placeholder}
        className="h-8 text-sm pr-7"
      />
      <ChevronDown
        className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none"
      />
      <AnimatePresence>
        {showDropdown && (
          <m.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.1 }}
            className="absolute z-50 top-full mt-1 w-full rounded-md border border-border bg-popover shadow-lg overflow-hidden"
          >
            <div className="max-h-48 overflow-y-auto py-1">
              {filtered.map(option => (
                <button
                  key={option}
                  type="button"
                  className={cn(
                    'w-full text-left px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                    value === option && 'bg-accent/40 font-medium',
                  )}
                  onMouseDown={e => {
                    e.preventDefault()
                    onChange(option)
                    setOpen(false)
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Tag input ─────────────────────────────────────────────────────────────────

function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const commit = () => {
    const trimmed = input.trim().replace(/,+$/, '').trim()
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed])
    }
    setInput('')
  }

  return (
    <div
      className="flex flex-wrap gap-1.5 rounded-md border border-input bg-transparent px-3 py-2 min-h-[38px] cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {values.map((v, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
        >
          {v}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(values.filter((_, j) => j !== i)) }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit() }
          if (e.key === 'Backspace' && !input && values.length) {
            onChange(values.slice(0, -1))
          }
        }}
        onBlur={commit}
        placeholder={values.length === 0 ? (placeholder ?? 'Type and press Enter…') : ''}
        className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}

// ── Section wrapper ────────────────────────────────────────────────────────────

function FormSection({
  title,
  children,
  collapsible = false,
}: {
  title: string
  children: React.ReactNode
  collapsible?: boolean
}) {
  const [open, setOpen] = useState(true)

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => collapsible && setOpen(o => !o)}
        className={cn(
          'flex w-full items-center justify-between px-4 py-3 text-left',
          'bg-muted/40 border-b border-border',
          collapsible && 'hover:bg-muted/70 transition-colors cursor-pointer',
          !collapsible && 'cursor-default',
        )}
      >
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {title}
        </span>
        {collapsible && (
          open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
               : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4">{children}</div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Field label + hint ─────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-muted-foreground mb-1.5">
      {children}
    </label>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground/60">{children}</p>
  )
}

// ── Avatar card ───────────────────────────────────────────────────────────────

function AvatarCard({
  avatar,
  index,
  onChange,
  onRemove,
}: {
  avatar: Avatar
  index: number
  onChange: (a: Avatar) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Avatar {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div>
        <Label>Avatar name</Label>
        <ComboboxInput
          value={avatar.name}
          onChange={name => onChange({ ...avatar, name })}
          options={AVATAR_NAME_OPTIONS}
          placeholder="e.g. Overworked Professional"
        />
        <Hint>A short archetype label used to target content at this specific person.</Hint>
      </div>
      <div>
        <Label>Pains — what keeps them up at night (Enter to add)</Label>
        <TagInput
          values={avatar.pains}
          onChange={pains => onChange({ ...avatar, pains })}
          placeholder="e.g. Can't scale past $10K/month…"
        />
        <Hint>Be specific. Vague pains ("wants more money") produce vague scripts.</Hint>
      </div>
      <div>
        <Label>Desires — their dream outcome (Enter to add)</Label>
        <TagInput
          values={avatar.desires}
          onChange={desires => onChange({ ...avatar, desires })}
          placeholder="e.g. Consistent $30K months without burnout…"
        />
        <Hint>The transformation the avatar wants. The AI uses this in the solution section.</Hint>
      </div>
    </div>
  )
}

// ── Proof point row ───────────────────────────────────────────────────────────

function ProofRow({
  proof,
  index,
  onChange,
  onRemove,
}: {
  proof: ProofPoint
  index: number
  onChange: (p: ProofPoint) => void
  onRemove: () => void
}) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Proof {index + 1}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div>
        <Label>Type</Label>
        <Select
          value={proof.type}
          onValueChange={v => onChange({ ...proof, type: v as ProofPoint['type'] })}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="result">Result — a measurable outcome</SelectItem>
            <SelectItem value="testimonial">Testimonial — a direct client quote</SelectItem>
            <SelectItem value="statistic">Statistic — a data point or percentage</SelectItem>
            <SelectItem value="case_study">Case Study — a named client journey</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Content</Label>
        <Textarea
          value={proof.content}
          onChange={e => onChange({ ...proof, content: e.target.value })}
          placeholder={PROOF_CONTENT_PLACEHOLDER[proof.type]}
          className="text-sm resize-none"
          rows={3}
        />
        <Hint>The AI quotes this verbatim. Use exact names, numbers, and timeframes — any change counts as fabrication and will fail the quality review.</Hint>
      </div>
      <div>
        <Label>Source</Label>
        <Input
          value={proof.source}
          onChange={e => onChange({ ...proof, source: e.target.value })}
          placeholder={PROOF_SOURCE_PLACEHOLDER[proof.type]}
          className="h-8 text-sm"
        />
      </div>
    </div>
  )
}

// ── Client list item ──────────────────────────────────────────────────────────

function ClientListItem({
  client,
  isSelected,
  onSelect,
  onDelete,
  isDeleting,
}: {
  client: ClientContext
  isSelected: boolean
  onSelect: () => void
  onDelete: () => void
  isDeleting: boolean
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-md px-3 py-2.5 transition-colors group',
        isSelected
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'hover:bg-sidebar-accent/60 text-sidebar-foreground/80 hover:text-sidebar-foreground',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{client.name}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">{client.niche}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {confirmDelete ? (
            <>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onDelete() }}
                disabled={isDeleting}
                className="rounded px-1.5 py-0.5 text-xs bg-destructive text-white hover:bg-destructive/80 transition-colors disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Confirm'}
              </button>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setConfirmDelete(false) }}
                className="rounded px-1.5 py-0.5 text-xs bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
              className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Client form ───────────────────────────────────────────────────────────────

function ClientForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial: ClientForm
  onSave: (form: ClientForm) => void
  onCancel: () => void
  isSaving: boolean
}) {
  const [form, setForm] = useState<ClientForm>(initial)

  const set = <K extends keyof ClientForm>(key: K, value: ClientForm[K]) =>
    setForm(f => ({ ...f, [key]: value }))

  const setBrandVoice = <K extends keyof ClientForm['brandVoice']>(
    key: K,
    value: ClientForm['brandVoice'][K],
  ) => setForm(f => ({ ...f, brandVoice: { ...f.brandVoice, [key]: value } }))

  const setOffer = <K extends keyof ClientForm['offerMechanics']>(
    key: K,
    value: ClientForm['offerMechanics'][K],
  ) => setForm(f => ({ ...f, offerMechanics: { ...f.offerMechanics, [key]: value } }))

  const setAvatar = (i: number, a: Avatar) =>
    setForm(f => { const avatars = [...f.avatars]; avatars[i] = a; return { ...f, avatars } })

  const addAvatar = () =>
    setForm(f => ({ ...f, avatars: [...f.avatars, { name: '', pains: [], desires: [] }] }))

  const removeAvatar = (i: number) =>
    setForm(f => ({ ...f, avatars: f.avatars.filter((_, j) => j !== i) }))

  const setProof = (i: number, p: ProofPoint) =>
    setForm(f => { const proofBank = [...f.proofBank]; proofBank[i] = p; return { ...f, proofBank } })

  const addProof = () =>
    setForm(f => ({ ...f, proofBank: [...f.proofBank, { type: 'result', content: '', source: '' }] }))

  const removeProof = (i: number) =>
    setForm(f => ({ ...f, proofBank: f.proofBank.filter((_, j) => j !== i) }))

  const canSave = form.name.trim() !== '' && form.niche.trim() !== ''

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <h2 className="text-sm font-semibold text-foreground">{initial.name || 'New Client'}</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-8 text-muted-foreground"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onSave(form)}
            disabled={!canSave || isSaving}
            className="h-8 gap-1.5"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Save
          </Button>
        </div>
      </div>

      {/* Scrollable form body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">

        {/* Basic info */}
        <FormSection title="Basic Info">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. Marcus Vane"
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label>Niche *</Label>
              <ComboboxInput
                value={form.niche}
                onChange={v => set('niche', v)}
                options={NICHE_OPTIONS}
                placeholder="Select or type a niche…"
              />
              <Hint>Used to contextualise every script for this client's market.</Hint>
            </div>
          </div>
          <div>
            <Label>Portfolio summary</Label>
            <Textarea
              value={form.portfolioSummary}
              onChange={e => set('portfolioSummary', e.target.value)}
              placeholder="e.g. 5 years helping 6-figure coaches scale to 7 figures. Known for a systems-first approach. 200+ clients. Regular speaker at industry events."
              className="text-sm resize-none"
              rows={3}
            />
            <Hint>A factual snapshot of the client's credibility. The AI uses this to anchor claims about the coach's track record.</Hint>
          </div>
        </FormSection>

        {/* Brand voice */}
        <FormSection title="Brand Voice" collapsible>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tone</Label>
              <ComboboxInput
                value={form.brandVoice.tone}
                onChange={v => setBrandVoice('tone', v)}
                options={TONE_OPTIONS}
                placeholder="Select or describe the tone…"
              />
              <Hint>The emotional register of the script — how it feels to the viewer.</Hint>
            </div>
            <div>
              <Label>Speaking style</Label>
              <ComboboxInput
                value={form.brandVoice.speakingStyle}
                onChange={v => setBrandVoice('speakingStyle', v)}
                options={SPEAKING_STYLE_OPTIONS}
                placeholder="Select or describe the style…"
              />
              <Hint>How the script sounds when read aloud. Affects sentence structure and rhythm.</Hint>
            </div>
          </div>
          <div>
            <Label>Words / phrases to never use</Label>
            <TagInput
              values={form.brandVoice.doNotUse}
              onChange={v => setBrandVoice('doNotUse', v)}
              placeholder="Type a word or phrase and press Enter…"
            />
            <Hint>The quality agent will flag any script that uses these. Be specific — "hustle culture language" is less useful than "grind", "crush it", "kill it".</Hint>
          </div>
          <div>
            <Label>Reference phrases (optional)</Label>
            <TagInput
              values={form.brandVoice.referenceExamples}
              onChange={v => setBrandVoice('referenceExamples', v)}
              placeholder={'e.g. "The gap is your edge" — press Enter to add…'}
            />
            <Hint>Signature lines or phrases this client actually uses. Helps the AI match their authentic voice.</Hint>
          </div>
        </FormSection>

        {/* Avatars */}
        <FormSection title="Target Avatars" collapsible>
          <div className="space-y-3">
            {form.avatars.map((a, i) => (
              <AvatarCard
                key={i}
                avatar={a}
                index={i}
                onChange={updated => setAvatar(i, updated)}
                onRemove={() => removeAvatar(i)}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addAvatar}
              className="w-full h-8 border-dashed text-muted-foreground gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Avatar
            </Button>
          </div>
        </FormSection>

        {/* Proof bank */}
        <FormSection title="Proof Bank" collapsible>
          <p className="text-[11px] text-muted-foreground/70 -mt-1">
            The quality review agent checks every claim in the script against this bank. Only entries listed here will pass.
          </p>
          <div className="space-y-3">
            {form.proofBank.map((p, i) => (
              <ProofRow
                key={i}
                proof={p}
                index={i}
                onChange={updated => setProof(i, updated)}
                onRemove={() => removeProof(i)}
              />
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addProof}
              className="w-full h-8 border-dashed text-muted-foreground gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Proof Entry
            </Button>
          </div>
        </FormSection>

        {/* Offer mechanics */}
        <FormSection title="Offer Mechanics" collapsible>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Product name</Label>
              <Input
                value={form.offerMechanics.productName}
                onChange={e => setOffer('productName', e.target.value)}
                placeholder="e.g. Executive Edge Program"
                className="h-8 text-sm"
              />
              <Hint>Used in the solution section by name.</Hint>
            </div>
            <div>
              <Label>Price</Label>
              <Input
                value={form.offerMechanics.price}
                onChange={e => setOffer('price', e.target.value)}
                placeholder="e.g. $5,000 / $997/month"
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div>
            <Label>Guarantee</Label>
            <Input
              value={form.offerMechanics.guarantee}
              onChange={e => setOffer('guarantee', e.target.value)}
              placeholder="e.g. 60-day visible results or full refund, no questions asked"
              className="h-8 text-sm"
            />
            <Hint>Used to lower resistance in the solution section. Be specific — "results guarantee" is weaker than an exact condition.</Hint>
          </div>
          <div>
            <Label>Key benefits (Enter to add)</Label>
            <TagInput
              values={form.offerMechanics.keyBenefits}
              onChange={v => setOffer('keyBenefits', v)}
              placeholder="e.g. Weekly 1:1 coaching calls…"
            />
          </div>
          <div>
            <Label>Call to action</Label>
            <Input
              value={form.offerMechanics.cta}
              onChange={e => setOffer('cta', e.target.value)}
              placeholder="e.g. Book a free strategy call at example.com/start"
              className="h-8 text-sm"
            />
            <Hint>This appears word-for-word at the end of every script. Include the exact URL or action.</Hint>
          </div>
        </FormSection>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyPanel({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      <div className="rounded-full bg-muted p-4">
        <Users className="h-6 w-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">No client selected</p>
        <p className="text-xs text-muted-foreground mt-1">
          Select a client to edit, or create a new one.
        </p>
      </div>
      <Button size="sm" onClick={onNew} className="gap-1.5">
        <Plus className="h-3.5 w-3.5" />
        New Client
      </Button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ClientsPage() {
  const { data: clients = [], isLoading } = useClients()
  const createMutation = useCreateClient()
  const updateMutation = useUpdateClient()
  const deleteMutation = useDeleteClient()

  // null = empty panel, 'new' = blank form, id = editing existing
  const [panel, setPanel] = useState<null | 'new' | string>(null)

  const selectedClient =
    panel && panel !== 'new' ? (clients.find(c => c.id === panel) ?? null) : null

  const initialForm: ClientForm =
    panel === 'new' ? emptyForm() : selectedClient ? clientToForm(selectedClient) : emptyForm()

  const handleSave = (form: ClientForm) => {
    if (panel === 'new') {
      createMutation.mutate(form, {
        onSuccess: (created) => { setPanel(created.id) },
      })
    } else if (selectedClient) {
      updateMutation.mutate({ id: selectedClient.id, ...form })
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <PageContainer>
      <SectionHeader
        title="Clients"
        description="Manage the real client profiles used by all pipeline agents."
      />

      <div className="flex h-[calc(100vh-160px)] rounded-lg border border-border overflow-hidden mt-4">
        {/* ── Left: client list ─────────────────────────────────────────── */}
        <aside className="w-64 shrink-0 flex flex-col border-r border-border bg-sidebar">
          <div className="flex items-center justify-between px-3 py-3 border-b border-border">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Clients
            </span>
            <button
              type="button"
              onClick={() => setPanel('new')}
              className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 transition-colors"
              title="New Client"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : clients.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                No clients yet.
              </p>
            ) : (
              clients.map(client => (
                <ClientListItem
                  key={client.id}
                  client={client}
                  isSelected={panel === client.id}
                  onSelect={() => setPanel(client.id)}
                  onDelete={() => {
                    deleteMutation.mutate(client.id)
                    if (panel === client.id) setPanel(null)
                  }}
                  isDeleting={deleteMutation.isPending && deleteMutation.variables === client.id}
                />
              ))
            )}
          </div>

          <div className="px-2 py-3 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPanel('new')}
              className="w-full h-8 gap-1.5 border-dashed text-muted-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              New Client
            </Button>
          </div>
        </aside>

        {/* ── Right: form panel ─────────────────────────────────────────── */}
        <main className="flex-1 overflow-hidden bg-background">
          <AnimatePresence mode="wait">
            {panel === null ? (
              <m.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                <EmptyPanel onNew={() => setPanel('new')} />
              </m.div>
            ) : (
              <m.div
                key={panel}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="h-full"
              >
                <ClientForm
                  initial={initialForm}
                  onSave={handleSave}
                  onCancel={() => setPanel(null)}
                  isSaving={isSaving}
                />
              </m.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </PageContainer>
  )
}
