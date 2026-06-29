/**
 * ICE scoring prompt — the only place where evaluation strategy is encoded.
 *
 * Separated from IceScoringAgent.ts so that:
 *   1. The scoring rubric can be iterated without touching agent logic.
 *   2. The agent stays focused on orchestration, validation, and mapping.
 *   3. Evaluation criteria for ICE never bleed into idea generation prompts.
 *
 * The function receives the full client context and all ideas to evaluate,
 * and returns a fully assembled prompt string ready for AIService.
 *
 * WHY CLIENT CONTEXT IS REQUIRED:
 *   Scores without context are guesses. "Target audience fit" cannot be evaluated
 *   without knowing the avatars. "Proof quality" requires the proof bank.
 *   "Business value" depends on the offer mechanics and client niche. Every score
 *   should reference something specific from the client context — that is what
 *   separates a useful evaluation from a generic one.
 */

import type { ClientContext, Idea } from '../types';

export function buildIceScoringPrompt(ideas: Idea[], context: ClientContext): string {
  const avatarsBlock = (context.avatars ?? [])
    .map(
      (a) =>
        `  Avatar: ${a.name}\n  Pains: ${(a.pains ?? []).join(' | ')}\n  Desires: ${(a.desires ?? []).join(' | ')}`
    )
    .join('\n\n');

  const proofBankBlock = (context.proofBank ?? [])
    .map((p) => `  [${p.type.toUpperCase()}] ${p.content}  (Source: ${p.source})`)
    .join('\n');

  const ideasBlock = ideas
    .map(
      (idea, i) =>
        `Idea ${i + 1} — ID: ${idea.id}\n` +
        `  Hook Line:      "${idea.hookLine}"\n` +
        `  Creative Type:  ${idea.creativeType}\n` +
        `  Angle:          ${idea.angle}\n` +
        `  Lead Type:      ${idea.leadType}\n` +
        `  Target Avatar:  ${idea.targetAvatar}\n` +
        `  Target Pain:    ${idea.targetPain}\n` +
        `  Supporting Proof: ${(idea.supportingProofPoints ?? []).join('; ')}`
    )
    .join('\n\n');

  return `You are a senior direct-response marketing strategist and creative director.
Your task: evaluate each marketing script concept below using the ICE framework.
Score each idea independently — do not rank ideas relative to each other.

━━━ CLIENT CONTEXT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CLIENT NAME:  ${context.name}
NICHE:        ${context.niche}
PORTFOLIO:    ${context.portfolioSummary}

── CUSTOMER AVATARS ──────────────────────────────────────────────

${avatarsBlock}

── OFFER MECHANICS ───────────────────────────────────────────────

  Product:        ${context.offerMechanics.productName}
  Price:          ${context.offerMechanics.price}
  Guarantee:      ${context.offerMechanics.guarantee}
  Key Benefits:   ${(context.offerMechanics.keyBenefits ?? []).join(', ')}
  CTA:            ${context.offerMechanics.cta}

── PROOF BANK ────────────────────────────────────────────────────

${proofBankBlock}

── BRAND VOICE ───────────────────────────────────────────────────

  Tone:           ${context.brandVoice.tone}
  Speaking Style: ${context.brandVoice.speakingStyle}
  Never Use:      ${(context.brandVoice.doNotUse ?? []).join(', ')}

━━━ IDEAS TO EVALUATE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${ideasBlock}

━━━ SCORING CRITERIA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Score each criterion from 1 (lowest) to 10 (highest).
Every score MUST be accompanied by a specific reason that references the client context above.
Generic reasons ("this is a good idea") are not acceptable.

IMPACT (1–10) — Business and marketing value
  Consider:
  • How directly does the hook address the target avatar's stated pain?
  • How well does this angle drive desire for the specific offer?
  • How strong is the proof alignment (does the proof bank support this angle)?
  • How likely is this to generate qualified leads at ${context.offerMechanics.price}?

CONFIDENCE (1–10) — Likelihood of strong performance
  Consider:
  • How credible is the concept given the available proof?
  • Does the angle align with what is known about this niche and audience?
  • How well does this fit the brand voice (tone: ${context.brandVoice.tone})?
  • How differentiated is this from typical content in the ${context.niche} space?

EASE (1–10) — Production feasibility
  Consider:
  • How complex is this format to produce (${context.name}'s team)?
  • Does the creative type (talking-head, ugc, story, etc.) require special resources?
  • How much scripting complexity does this angle demand?
  • Higher scores = simpler production. A 10 = can be filmed in 10 minutes with a phone.

━━━ RECOMMENDATION RULES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

APPROVE   — Strong idea. Recommend moving to script generation immediately.
CONSIDER  — Decent idea with potential. Needs refinement or has a notable weakness.
REJECT    — Weak concept. Low probability of delivering results for this client.

Base your recommendation on holistic judgment — not a mechanical average.
An idea with Impact 9 but Ease 2 may warrant CONSIDER instead of APPROVE.

━━━ ABSOLUTE RULES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. All scores must be whole integers between 1 and 10 (inclusive).
2. Every reason must reference something specific from the client context.
3. Return a score for EVERY idea — do not skip any.
4. The "id" in each response object must exactly match the idea ID provided above.

━━━ RESPONSE FORMAT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY a valid JSON array. No markdown. No explanation. No extra fields.
Start with [ and end with ].

Each object must match this exact schema:

{
  "ideaId": "<exact ID from the idea above>",
  "impact": <integer 1–10>,
  "impactReason": "<specific reason referencing client context>",
  "confidence": <integer 1–10>,
  "confidenceReason": "<specific reason referencing client context>",
  "ease": <integer 1–10>,
  "easeReason": "<specific reason referencing client context>",
  "overallReasoning": "<2–3 sentence holistic evaluation>",
  "recommendation": "<APPROVE | CONSIDER | REJECT>"
}`;
}
