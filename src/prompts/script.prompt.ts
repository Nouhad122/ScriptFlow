/**
 * Script generation prompt — the only place where scriptwriting strategy is encoded.
 *
 * Separated from ScriptAgent.ts so that:
 *   1. Copywriting strategy can be iterated without touching agent or validation logic.
 *   2. The agent stays focused on parsing, validation, and mapping.
 *   3. Prompt changes are isolated and diffable.
 *
 * WHY CLIENT CONTEXT IS REQUIRED:
 *   A script that could apply to any client is not a script — it is a template.
 *   Every section must reference something specific: the avatar's exact pain,
 *   the proof bank's actual results, the offer's real guarantee. The prompt
 *   enforces this by listing the proof bank explicitly and instructing the AI
 *   to use it and nothing else.
 *
 * WHY PREVIOUS SCRIPTS ARE PASSED AS CONTEXT (memoryContext):
 *   The Memory Agent supplies previously approved scripts so the AI can learn
 *   from what worked. It avoids repeating structural patterns, phrase choices,
 *   and proof references that have already been used. When memoryContext is
 *   empty (as in Phase 1), the AI generates from the idea and context alone.
 *   The prompt handles this gracefully — if the array is empty, the section
 *   is omitted rather than shown as "(none)".
 *
 * TARGET LENGTH:
 *   A 45–90 second short-form video requires approximately 100–220 spoken words.
 *   Each section has a target word count to keep total length on target.
 *   Production notes are not spoken — they are excluded from the word count.
 */

import type { ClientContext, Idea, Script } from '../types';

export function buildScriptPrompt(
  idea: Idea,
  context: ClientContext,
  memoryContext: Script[]
): string {
  const avatarsBlock = context.avatars
    .map(
      (a) =>
        `  Name:    ${a.name}\n` +
        `  Pains:   ${a.pains.join(' | ')}\n` +
        `  Desires: ${a.desires.join(' | ')}`
    )
    .join('\n\n');

  const proofBankBlock = context.proofBank
    .map((p) => `  [${p.type.toUpperCase()}] "${p.content}"  (Source: ${p.source})`)
    .join('\n');

  const memoryBlock =
    memoryContext.length > 0
      ? memoryContext
          .map(
            (s, i) =>
              `  Script ${i + 1} (hook1): "${s.hook1}"\n` +
              `  Problem: "${s.body.problem}"\n` +
              `  CTA: "${s.body.cta}"`
          )
          .join('\n\n')
      : null;

  const ideaBlock =
    `  Hook Line:        "${idea.hookLine}"\n` +
    `  Creative Type:    ${idea.creativeType}\n` +
    `  Angle:            ${idea.angle}\n` +
    `  Lead Type:        ${idea.leadType}\n` +
    `  Target Avatar:    ${idea.targetAvatar}\n` +
    `  Target Pain:      "${idea.targetPain}"\n` +
    `  Supporting Proof: ${idea.supportingProofPoints.join(' | ')}` +
    (idea.iceScore
      ? `\n  ICE Reasoning:    "${idea.iceScore.overallReasoning}"`
      : '');

  return `You are a professional short-form video scriptwriter specialising in high-ticket coaching and online business content.
Your task: write a production-ready script for the approved idea below.

━━━ CRITICAL RULES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ONLY use proof from the PROOF BANK listed below. Never invent results, statistics, or testimonials.
2. Match the BRAND VOICE exactly — do not deviate from tone or speaking style.
3. Write for spoken delivery — conversational, natural, no corporate jargon.
4. Target total spoken word count: 130–210 words (suitable for a 45–90 second video).
5. Write THREE distinct hook options. Each must approach the concept from a different angle.
6. Do not repeat phrases, structures, or proof references from PREVIOUS SCRIPTS if they are listed below.

━━━ CLIENT CONTEXT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CLIENT:     ${context.name}
NICHE:      ${context.niche}
PORTFOLIO:  ${context.portfolioSummary}

── CUSTOMER AVATARS ──────────────────────────────────────────────

${avatarsBlock}

── BRAND VOICE ───────────────────────────────────────────────────

  Tone:           ${context.brandVoice.tone}
  Speaking Style: ${context.brandVoice.speakingStyle}
  Never Use:      ${context.brandVoice.doNotUse.join(', ')}${context.brandVoice.referenceExamples.length > 0 ? `\n  Reference Examples:\n${context.brandVoice.referenceExamples.map((e) => `    "${e}"`).join('\n')}` : ''}

── PROOF BANK — use only what is listed here ─────────────────────

${proofBankBlock}

── OFFER MECHANICS ───────────────────────────────────────────────

  Product:      ${context.offerMechanics.productName}
  Price:        ${context.offerMechanics.price}
  Guarantee:    ${context.offerMechanics.guarantee}
  Key Benefits: ${context.offerMechanics.keyBenefits.join(', ')}
  CTA:          ${context.offerMechanics.cta}
${memoryBlock ? `\n── PREVIOUSLY APPROVED SCRIPTS (avoid repeating these patterns) ──\n\n${memoryBlock}\n` : ''}
━━━ APPROVED IDEA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${ideaBlock}

━━━ SECTION GUIDELINES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HOOK 1, 2, 3  (15–25 words each — three distinct opening lines)
  The first 1–2 spoken sentences. Must make the viewer stop scrolling immediately.
  Each hook must approach the same core concept from a completely different angle:
    hook1 — lead with the pain or problem
    hook2 — lead with a result or proof
    hook3 — lead with a curiosity gap or counterintuitive claim

PROBLEM  (30–50 words)
  Agitate the pain. Make the target avatar feel completely seen and understood.
  Do not introduce the solution yet. Reference the specific target pain above.
  Use "you" language — speak directly to the viewer.

STORY  (25–40 words)
  A narrative bridge from problem to solution. This is where emotional connection happens.
  Options: a brief client scenario, a relatable moment, a surprising insight, a contrast.
  This section must feel real and specific, not generic.

SOLUTION  (25–40 words)
  Introduce ${context.offerMechanics.productName} as the answer. Keep it conversational.
  Name what changes for the viewer if they take action. Do not oversell.
  Let the proof section do the heavy lifting — keep this focused on the transformation.

PROOF  (30–50 words)
  Pull ONLY from the proof bank above. Be specific — exact numbers, exact names, exact outcomes.
  Quote or paraphrase directly. Never approximate in a way that changes the meaning.
  If multiple proof points are relevant, prioritise the one most directly tied to the idea's angle.

CTA  (15–25 words)
  One clear, specific, low-friction action. Use the CTA from offer mechanics above.
  Write it as a natural next step — not a command. Avoid "click the link below" clichés.

PRODUCTION NOTES  (optional)
  Brief filming or delivery directions only (e.g. "Speak to camera, no B-roll needed").
  Omit if the script is self-explanatory. Return null if no notes are needed.

━━━ RESPONSE FORMAT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY valid JSON. No markdown fences. No explanation. No extra fields.
Start with { and end with }.

{
  "hook1": "<first hook — pain/problem led>",
  "hook2": "<second hook — result/proof led>",
  "hook3": "<third hook — curiosity/counterintuitive led>",
  "body": {
    "problem": "<agitate the pain, make viewer feel seen>",
    "story": "<narrative bridge — relatable scenario or insight>",
    "solution": "<introduce the product/transformation>",
    "proof": "<specific proof from the proof bank only>",
    "cta": "<clear, natural call to action>"
  },
  "productionNotes": "<brief filming notes or null>"
}`;
}
