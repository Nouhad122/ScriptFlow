/**
 * Idea types map exactly to the 11 required fields defined in the assessment brief (Section 4).
 *
 * IceScore is separated from Idea intentionally: the ICE Scoring Agent owns scoring
 * and attaches it to an existing Idea. Keeping them separate makes the two-stage
 * pipeline visible in the type system.
 *
 * IceRecommendation drives the human approval UI — the human sees a pre-populated
 * recommendation but makes the final decision. APPROVE/CONSIDER/REJECT are the
 * only three states the AI can suggest; ApprovalStatus tracks the human's actual choice.
 */

export type CreativeType =
  | 'talking-head'
  | 'ugc'
  | 'listicle'
  | 'story'
  | 'demo'
  | 'testimonial'
  | 'other';

export type LeadType = 'problem-led' | 'proof-led' | 'curiosity-led' | 'offer-led';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type IceRecommendation = 'APPROVE' | 'CONSIDER' | 'REJECT';

export interface IceScore {
  impact: number;
  impactReason: string;

  confidence: number;
  confidenceReason: string;

  ease: number;
  easeReason: string;

  overallReasoning: string;

  recommendation: IceRecommendation;
}

export interface Idea {
  id: string;
  clientId: string;
  pipelineRunId: string;

  // Assessment brief required fields (Section 4)
  hookLine: string;
  creativeType: CreativeType;
  angle: string;
  leadType: LeadType;
  supportingProofPoints: string[];
  targetAvatar: string;
  targetPain: string;

  // Set by the ICE Scoring Agent after generation
  iceScore: IceScore | null;

  // Set by the human approver via the dashboard
  approvalStatus: ApprovalStatus;

  createdAt: Date;
}
