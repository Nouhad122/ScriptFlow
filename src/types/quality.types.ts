/**
 * QualityReview models the 10-point checklist from the assessment brief (Section 5).
 *
 * Every item is evaluated individually — the Quality Review Agent must check each
 * one explicitly and return a reason. This prevents a "rubber stamp" review that
 * just asks the model "is this good?" and trusts the answer.
 *
 * finalPassed is true only if ALL 10 items passed. A single failure holds the script.
 */

export interface ChecklistItem {
  passed: boolean;
  reason: string;
}

export interface QualityChecklist {
  // Item 1: Hook opens with a pattern interrupt in the first 3 seconds
  patternInterrupt: ChecklistItem;

  // Item 2: Clear problem or pain statement present
  painStatement: ChecklistItem;

  // Item 3: Unique mechanism or differentiator explained
  uniqueMechanism: ChecklistItem;

  // Item 4: Social proof or credibility element included
  socialProof: ChecklistItem;

  // Item 5: CTA matches funnel stage (cold traffic vs. retargeting)
  ctaFunnelMatch: ChecklistItem;

  // Item 6: Script length within target range (60–180 seconds A-roll)
  scriptLength: ChecklistItem;

  // Item 7: Client brand voice / rhythm alignment
  brandVoice: ChecklistItem;

  // Item 8: No fabricated claims or unverifiable statistics
  noFabrication: ChecklistItem;

  // Item 9: Curiosity or open loop used to maintain watch time
  openLoop: ChecklistItem;

  // Item 10: VSL structure followed: Pain > Promise > Proof > CTA
  vslStructure: ChecklistItem;
}

export interface QualityReview {
  id: string;
  scriptId: string;

  checklist: QualityChecklist;

  // true only when every checklist item passed
  finalPassed: boolean;

  // Summary from the Quality Review Agent
  overallFeedback: string;

  // Populated when finalPassed is false — explains why the script was held
  heldReason?: string;

  reviewedAt: Date;
}
