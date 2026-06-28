/**
 * Script is the output of the Script Agent.
 * It models the exact required output format from the assessment brief (Section 3):
 *   - Three hook options
 *   - Main body following Pain > Promise > Proof > CTA
 *   - Optional production notes (top or bottom — kept out of body)
 *
 * ScriptStatus tracks the script through the quality gate:
 *   'pending_review' → Quality Review Agent runs → 'passed' | 'held'
 */

export type ScriptStatus = 'pending_review' | 'passed' | 'held';

export interface ScriptBody {
  pain: string;
  promise: string;
  proof: string;
  cta: string;
}

export interface Script {
  id: string;
  ideaId: string;
  clientId: string;
  pipelineRunId: string;

  // Required output format from the assessment brief
  productionNotes: string | null;
  hook1: string;
  hook2: string;
  hook3: string;
  body: ScriptBody;

  status: ScriptStatus;
  deliveredAt: Date | null;
  outputPath: string | null;

  createdAt: Date;
}
