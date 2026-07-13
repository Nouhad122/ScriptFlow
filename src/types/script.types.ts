/**
 * Script is the output of the Script Agent.
 * It models the exact required output format from the assessment brief (Section 3):
 *   - Three hook options (A/B testing flexibility for the client)
 *   - Main body following Problem > Story > Solution > Proof > CTA
 *   - Optional production notes (kept separate from spoken content)
 *
 * WHY THREE HOOKS:
 *   The assessment brief requires three hook options. Three hooks give the content
 *   director flexibility to A/B test and match the platform's tone for a given day.
 *   A single hook limits production creativity.
 *
 * WHY story IS A SEPARATE FIELD (not folded into problem or solution):
 *   The narrative arc of problem → story/context → solution is standard in
 *   high-converting direct-response video. Without a bridge, the script jumps
 *   from pain directly to pitch, which feels abrupt. The story section — a
 *   relatable anecdote, a client scenario, a surprising insight — makes the
 *   viewer feel "that's me" before the solution is offered. The Quality Review
 *   Agent will evaluate this section independently.
 *
 * ScriptStatus tracks the script through the quality gate:
 *   'pending_review' → QualityReviewAgent runs → 'passed' | 'held'
 */

export type ScriptStatus = 'pending_review' | 'passed' | 'held';

// Per-section delivery and visual notes — one entry per body section.
// Null for scripts generated before this feature was added.
export interface SectionNotes {
  problem: string;
  story: string;
  solution: string;
  proof: string;
  cta: string;
}

export interface ScriptBody {
  problem: string; // the pain/problem the idea addresses — makes the viewer feel seen
  story: string; // narrative bridge from problem to solution — creates emotional connection
  solution: string; // the promise/solution offered — what changes if they act
  proof: string; // evidence exclusively from the proof bank — never fabricated
  cta: string; // call to action — specific, low-friction, natural
}

export interface Script {
  id: string;
  ideaId: string;
  clientId: string;
  pipelineRunId: string;

  // Three hook options — assessment brief requirement (Section 3)
  hook1: string;
  hook2: string;
  hook3: string;

  // Main body following the Problem > Story > Solution > Proof > CTA arc
  body: ScriptBody;

  // Optional production notes — filming/delivery direction, kept out of spoken content
  productionNotes: string | null;

  // Per-section delivery cues and visual directions (null on pre-feature scripts)
  sectionPacing: SectionNotes | null;
  sectionVisuals: SectionNotes | null;

  status: ScriptStatus;
  deliveredAt: Date | null;
  outputPath: string | null;

  createdAt: Date;
}
