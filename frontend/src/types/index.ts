// ── Client context (mirrored from backend src/types/client.types.ts) ─────────

export interface Avatar {
  name: string
  pains: string[]
  desires: string[]
}

export interface BrandVoice {
  tone: string
  speakingStyle: string
  doNotUse: string[]
  referenceExamples: string[]
}

export interface ProofPoint {
  type: 'result' | 'testimonial' | 'statistic' | 'case_study'
  content: string
  source: string
}

export interface OfferMechanics {
  productName: string
  price: string
  guarantee: string
  keyBenefits: string[]
  cta: string
}

export interface ClientContext {
  id: string
  name: string
  niche: string
  avatars: Avatar[]
  brandVoice: BrandVoice
  proofBank: ProofPoint[]
  offerMechanics: OfferMechanics
  portfolioSummary: string
  referencePackPath: string
}

// ── Pipeline types (mirrored from backend src/types/pipeline.types.ts) ────────

export interface PipelineSummary {
  totalIdeas: number
  approvedCandidates: number
  considerCandidates: number
  rejectedCandidates: number
}

export interface PipelineTimings {
  ideaGenerationMs: number
  iceScoringMs: number
  persistenceMs: number
  totalMs: number
}

export interface PipelineRunSuccess {
  success: true
  pipelineRunId: string
  generatedAt: string
  clientId: string
  summary: PipelineSummary
  timings: PipelineTimings
  ideas: Idea[]
}

// ── Backend entity types (mirrored from backend src/types/) ─────────────────

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export type ScriptStatus = 'pending_review' | 'passed' | 'held'
export type QualityDecision = 'PASS' | 'HOLD'
export type PipelineStatus = 'completed' | 'failed'

export interface IceScore {
  impact: number
  impactReason: string
  confidence: number
  confidenceReason: string
  ease: number
  easeReason: string
  overallReasoning: string
  recommendation: 'APPROVE' | 'CONSIDER' | 'REJECT'
}

export interface Idea {
  id: string
  clientId: string
  pipelineRunId: string
  hookLine: string
  creativeType: string
  angle: string
  leadType: string
  supportingProofPoints: string[]
  targetAvatar: string
  targetPain: string
  iceScore: IceScore | null
  approvalStatus: ApprovalStatus
  approvedAt: string | null
  approvedBy: string | null
  createdAt: string
}

export interface ScriptBody {
  problem: string
  story: string
  solution: string
  proof: string
  cta: string
}

export interface SectionNotes {
  problem: string
  story: string
  solution: string
  proof: string
  cta: string
}

export interface Script {
  id: string
  ideaId: string
  clientId: string
  pipelineRunId: string
  hook1: string
  hook2: string
  hook3: string
  body: ScriptBody
  productionNotes: string | null
  sectionPacing: SectionNotes | null
  sectionVisuals: SectionNotes | null
  status: ScriptStatus
  deliveredAt: string | null
  outputPath: string | null
  createdAt: string
}

// ── Quality review types (mirrored from backend src/types/quality.types.ts) ──

export interface QualityScoreCheck {
  pass: boolean
  score: number
  reason: string
}

export interface QualityBooleanCheck {
  pass: boolean
  reason: string
}

export interface QualityChecks {
  hookStrength: QualityScoreCheck
  problemClarity: QualityScoreCheck
  storyFlow: QualityScoreCheck
  solutionAlignment: QualityScoreCheck
  proofAccuracy: QualityScoreCheck
  ctaAlignment: QualityScoreCheck
  brandVoice: QualityScoreCheck
  fabrication: QualityBooleanCheck
  length: QualityBooleanCheck
  structure: QualityBooleanCheck
}

export interface QualityReview {
  id: string
  scriptId: string
  ideaId: string
  pipelineRunId: string
  overallDecision: QualityDecision
  overallScore: number
  checks: QualityChecks
  createdAt: string
}

export type ScriptWithHook = Script & { ideaHookLine: string }

export interface DashboardSummary {
  pipelines: number
  ideasGenerated: number
  pendingIdeas: number
  approvedIdeas: number
  rejectedIdeas: number
  scriptsGenerated: number
  pendingReviews: number
  passedReviews: number
  heldReviews: number
}

// ── API response wrapper ─────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true
  data: T
}

export interface ApiError {
  message: string
  status: number
}

// ── Pipeline history types (mirrored from backend src/database/pipeline.repository.ts) ──

export interface PipelineRunRecord {
  id: string
  clientId: string
  status: PipelineStatus
  totalIdeas: number
  approvedCandidates: number
  considerCandidates: number
  rejectedCandidates: number
  ideaGenerationMs: number | null
  iceScoringMs: number | null
  persistenceMs: number | null
  totalMs: number | null
  failedStage: string | null
  errorMessage: string | null
  startedAt: string
  completedAt: string | null
}

export interface PipelineAnalytics {
  totalRuns: number
  completedRuns: number
  failedRuns: number
  successRate: number
  averageTotalMs: number | null
  longestTotalMs: number | null
  fastestTotalMs: number | null
}

// ── UI utility types ─────────────────────────────────────────────────────────

export type Status = ApprovalStatus | ScriptStatus | QualityDecision | PipelineStatus
