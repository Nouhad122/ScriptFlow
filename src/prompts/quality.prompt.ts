/**
 * Quality review prompt — the only place where evaluation criteria are encoded.
 *
 * Separated from QualityReviewAgent.ts so that:
 *   1. Evaluation criteria can be tightened without touching agent or validation logic.
 *   2. The agent stays focused on validation, override logic, and mapping.
 *   3. Changes to what "quality" means are isolated and diffable.
 *
 * WHY ALL THREE INPUTS ARE IN THE PROMPT (script + idea + context):
 *   - Script: the content being evaluated — all three hooks and five body sections
 *   - Idea:   the approved concept — ground truth for hookLine, targetPain, angle
 *   - Context: the client reference — proof bank (for fabrication), brand voice, offer
 *
 *   Without the Idea, the agent cannot check whether the hook stayed true to the
 *   approved concept or whether the body addressed the right targetPain.
 *   Without the Context, the agent cannot detect fabricated proof or brand voice drift.
 *
 * WHY fabrication IS EVALUATED STRICTLY:
 *   The proof bank is the only authoritative source of results, testimonials, and
 *   statistics. Any claim in the script that cannot be traced back to a specific entry
 *   in the proof bank is fabrication — regardless of how plausible it sounds.
 *   This is a hard-fail check: a plausible-sounding fabrication is MORE dangerous
 *   than an obvious one, because it may reach the client undetected.
 */

import type { ClientContext, Idea, Script } from '../types';
import { QUALITY_CALIBRATION } from './quality.calibration';

export function buildQualityReviewPrompt(
  script: Script,
  idea: Idea,
  context: ClientContext
): string {
  const scriptBlock =
    `  Hook 1: "${script.hook1}"\n` +
    `  Hook 2: "${script.hook2}"\n` +
    `  Hook 3: "${script.hook3}"\n\n` +
    `  Problem:  "${script.body.problem}"\n` +
    `  Story:    "${script.body.story}"\n` +
    `  Solution: "${script.body.solution}"\n` +
    `  Proof:    "${script.body.proof}"\n` +
    `  CTA:      "${script.body.cta}"` +
    (script.productionNotes ? `\n  Production Notes: "${script.productionNotes}"` : '');

  const ideaBlock =
    `  Hook Line (approved concept): "${idea.hookLine}"\n` +
    `  Angle:          ${idea.angle}\n` +
    `  Lead Type:      ${idea.leadType}\n` +
    `  Target Avatar:  ${idea.targetAvatar}\n` +
    `  Target Pain:    "${idea.targetPain}"\n` +
    `  Supporting Proof (approved references): ${(idea.supportingProofPoints ?? []).join(' | ')}`;

  const proofBankBlock = (context.proofBank ?? [])
    .map((p, i) => `  [${i + 1}] [${p.type.toUpperCase()}] "${p.content}"  (Source: ${p.source})`)
    .join('\n');

  return `You are a senior content strategist and quality director for a high-ticket coaching brand.
Your task: evaluate this script critically and honestly against 10 quality criteria.

Do not default to generous scores. Do not default to harsh ones either.
Score what is actually on the page — not what you assume was intended.
You EVALUATE ONLY. Do not rewrite, edit, or suggest alternative wording.
${QUALITY_CALIBRATION}

━━━ CLIENT REFERENCE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CLIENT:     ${context.name}
NICHE:      ${context.niche}

── BRAND VOICE ────────────────────────────────────────────────

  Tone:           ${context.brandVoice?.tone ?? 'not specified'}
  Speaking Style: ${context.brandVoice?.speakingStyle ?? 'not specified'}
  Never Use:      ${(context.brandVoice?.doNotUse ?? []).join(', ') || 'none listed'}

── PROOF BANK (the only authorised source of results and testimonials) ─

${proofBankBlock || '  (no proof entries provided)'}

── OFFER MECHANICS ────────────────────────────────────────────

  Product:    ${context.offerMechanics?.productName ?? 'not specified'}
  Price:      ${context.offerMechanics?.price ?? 'not specified'}
  Guarantee:  ${context.offerMechanics?.guarantee ?? 'not specified'}
  CTA:        ${context.offerMechanics?.cta ?? 'not specified'}

━━━ APPROVED IDEA (the concept this script must deliver) ━━━━━━

${ideaBlock}

━━━ SCRIPT TO EVALUATE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${scriptBlock}

━━━ EVALUATION CRITERIA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Evaluate each of the 10 criteria below. For scored criteria (1–10), a score of 6 or
higher means pass:true. A score of 5 or lower means pass:false. For binary criteria,
use your judgment against the specific rule defined.

── SCORED CRITERIA (1–10) ─────────────────────────────────────

1. hookStrength — Does Hook 1 earn the viewer's next few seconds of attention?
   Evaluate: emotional relevance to "${idea.targetPain}", engagement, directness.
   Is the hook tied to the approved angle: "${idea.angle}"?
   A hook that merely names the audience or restates a pain without any pull scores 4–5.
   A hook that creates mild but genuine curiosity — the viewer wants to know what comes next —
   earns a 6 and passes. A genuine pattern interrupt (reframe, counterintuitive claim, or a scene
   so specific the viewer recognises themselves) earns 7+.
   Score 1–5 = pass:false. Score 6–10 = pass:true.

2. problemClarity — Is the problem section clear and specific to the target avatar?
   Evaluate: does the viewer feel seen? Is "${idea.targetPain}" addressed directly?
   Does the problem section make the viewer think "that's exactly my situation"?
   Score 1–5 = pass:false. Score 6–10 = pass:true.

3. storyFlow — Does the story section bridge from problem to solution naturally?
   Evaluate: is there a relatable scenario or genuine insight? Does it feel real and specific?
   Does it create emotional connection before introducing the solution?
   Score 1–5 = pass:false. Score 6–10 = pass:true.

4. solutionAlignment — Does the solution section match what was approved?
   Evaluate: is ${context.offerMechanics?.productName ?? 'the product'} introduced naturally?
   Does it promise transformation without overselling? Does it follow naturally from the story?
   Score 1–5 = pass:false. Score 6–10 = pass:true.

5. proofAccuracy — Is the proof section grounded in the proof bank?
   Evaluate: do the claims in the proof section match specific entries in the PROOF BANK above?
   Are numbers, names, and timeframes accurate to the source? Is anything approximate or paraphrased
   in a way that changes the meaning? Be strict: any unverifiable specific claim is a problem.
   Score 1–5 = pass:false. Score 6–10 = pass:true.

6. ctaAlignment — Does the CTA match the approved call to action from offer mechanics?
   Evaluate: does the CTA use the correct action verb and destination?
   Is it natural and low-friction? Does it avoid generic phrases like "click the link below"?
   The approved CTA is: "${context.offerMechanics?.cta ?? 'not specified'}".
   Score 1–5 = pass:false. Score 6–10 = pass:true.

7. brandVoice — Does the entire script match the client's brand voice?
   Evaluate: is the tone "${context.brandVoice?.tone ?? 'not specified'}"?
   Is the speaking style "${context.brandVoice?.speakingStyle ?? 'not specified'}"?
   Are any of the forbidden words/phrases used: ${(context.brandVoice?.doNotUse ?? []).join(', ') || 'none listed'}?
   Does the script feel like it comes from ${context.name} specifically, not a generic coach?
   Score 1–5 = pass:false. Score 6–10 = pass:true.

── BINARY CRITERIA (pass:true or pass:false) ──────────────────

8. fabrication — Are ALL claims supported by the proof bank?
   Rule: EVERY specific result, statistic, testimonial, or named case study in the script
   must be traceable to a specific entry in the PROOF BANK listed above.
   If ANY claim is not in the proof bank, pass:false.
   Vague claims like "many clients" are acceptable. Named results or quoted numbers are not.
   Be strict: "Marcus went from X to Y" only passes if that exact claim is in the proof bank.

9. length — Is the script within a reasonable spoken word count for short-form video?
   Count the spoken words in: Hook 1 + Problem + Story + Solution + Proof + CTA.
   (Do NOT count Hook 2, Hook 3, or Production Notes — they are not in the main spoken script.)
   Valid range: 60–280 spoken words (covers all durations from 30-second to 120-second videos).
   pass:false only if the total is clearly under 60 words (too short to deliver any value)
   or clearly over 280 words (too long for short-form video).

10. structure — Does the script follow the required narrative arc?
    Required order: Problem → Story → Solution → Proof → CTA.
    Each section must be present and in logical sequence.
    pass:false if any section is absent or the order is wrong.

━━━ SCORING RULES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- overallScore: your holistic assessment on a 0–100 scale. This is your professional judgment,
  not a mathematical average. A competent AI script that correctly addresses the brief typically
  scores 65–82. Scores above 88 indicate genuinely exceptional quality and should be rare.
- overallDecision: "PASS" if ALL 10 checks have pass:true. "HOLD" if ANY check has pass:false.
- Every reason MUST be specific — reference actual text from the script or a specific proof bank
  entry. Generic reasons like "this is good" or "well written" are not acceptable.

━━━ RESPONSE FORMAT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY valid JSON. No markdown fences. No explanation. No extra fields.

{
  "overallDecision": "PASS" | "HOLD",
  "overallScore": <integer 0–100>,
  "checks": {
    "hookStrength":      { "pass": <bool>, "score": <int 1–10>, "reason": "<specific reason>" },
    "problemClarity":    { "pass": <bool>, "score": <int 1–10>, "reason": "<specific reason>" },
    "storyFlow":         { "pass": <bool>, "score": <int 1–10>, "reason": "<specific reason>" },
    "solutionAlignment": { "pass": <bool>, "score": <int 1–10>, "reason": "<specific reason>" },
    "proofAccuracy":     { "pass": <bool>, "score": <int 1–10>, "reason": "<specific reason>" },
    "ctaAlignment":      { "pass": <bool>, "score": <int 1–10>, "reason": "<specific reason>" },
    "brandVoice":        { "pass": <bool>, "score": <int 1–10>, "reason": "<specific reason>" },
    "fabrication":       { "pass": <bool>, "reason": "<specific reason>" },
    "length":            { "pass": <bool>, "reason": "<estimated word count and verdict>" },
    "structure":         { "pass": <bool>, "reason": "<section presence and order assessment>" }
  }
}`;
}
