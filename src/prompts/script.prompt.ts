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
 *   empty, the AI generates from the idea and context alone.
 *   The prompt handles this gracefully — if the array is empty, the section
 *   is omitted rather than shown as "(none)".
 *
 * TARGET LENGTH:
 *   Driven by the videoDuration parameter chosen by the user before generation.
 *   Each preset maps to a total spoken word count and per-section word targets
 *   so the AI distributes content proportionally regardless of duration.
 */

import type { ClientContext, Idea, Script } from '../types';
import type { VideoDuration } from '../types';

// ---------------------------------------------------------------------------
// Duration targets
// ---------------------------------------------------------------------------

interface DurationTargets {
  totalWords: string;
  seconds: string;
  hookWords: string;
  problemWords: string;
  storyWords: string;
  solutionWords: string;
  proofWords: string;
  ctaWords: string;
}

const DURATION_TARGETS: Record<VideoDuration, DurationTargets> = {
  '30s': {
    totalWords: '60–80',
    seconds: '~30',
    hookWords: '8–12',
    problemWords: '12–18',
    storyWords: '10–14',
    solutionWords: '10–14',
    proofWords: '12–18',
    ctaWords: '8–12',
  },
  '45-60s': {
    totalWords: '105–140',
    seconds: '45–60',
    hookWords: '12–18',
    problemWords: '22–32',
    storyWords: '18–26',
    solutionWords: '18–26',
    proofWords: '22–32',
    ctaWords: '10–15',
  },
  '60-90s': {
    totalWords: '140–210',
    seconds: '60–90',
    hookWords: '15–25',
    problemWords: '30–50',
    storyWords: '25–40',
    solutionWords: '25–40',
    proofWords: '30–50',
    ctaWords: '15–25',
  },
  '90-120s': {
    totalWords: '210–280',
    seconds: '90–120',
    hookWords: '20–30',
    problemWords: '45–65',
    storyWords: '38–55',
    solutionWords: '38–55',
    proofWords: '45–65',
    ctaWords: '18–28',
  },
};

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

export function buildScriptPrompt(
  idea: Idea,
  context: ClientContext,
  memoryContext: Script[],
  qualityFeedback?: string,
  videoDuration: VideoDuration = '60-90s',
): string {
  const dt = DURATION_TARGETS[videoDuration];

  const avatarsBlock = (context.avatars ?? [])
    .map(
      (a) =>
        `  Name:    ${a.name}\n` +
        `  Pains:   ${(a.pains ?? []).join(' | ')}\n` +
        `  Desires: ${(a.desires ?? []).join(' | ')}`
    )
    .join('\n\n');

  const proofBankBlock = (context.proofBank ?? [])
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
    `  Supporting Proof: ${(idea.supportingProofPoints ?? []).join(' | ')}` +
    (idea.iceScore ? `\n  ICE Reasoning:    "${idea.iceScore.overallReasoning}"` : '');

  return `You are a professional short-form video scriptwriter specialising in high-ticket coaching and online business content.
Your task: write a production-ready script for the approved idea below.

━━━ CRITICAL RULES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ONLY use proof from the PROOF BANK listed below. Never invent results, statistics, or testimonials.
2. Match the BRAND VOICE exactly — do not deviate from tone or speaking style.
3. Write for spoken delivery — conversational, natural, no corporate jargon.
4. REQUIRED spoken word count: ${dt.totalWords} words total across Hook 1 + Problem + Story + Solution + Proof + CTA. This is a hard requirement, not a suggestion. The user chose a ${dt.seconds} second video — honour that decision exactly.
5. Write THREE distinct hook options. Each must approach the concept from a different angle.
6. Do not repeat phrases, structures, or proof references from PREVIOUS SCRIPTS if they are listed below.
7. Every JSON field (hook1, hook2, hook3, body.problem, body.story, body.solution, body.proof, body.cta) MUST be a non-empty string. Never return null or "" for these fields.

━━━ CLIENT CONTEXT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CLIENT:     ${context.name}
NICHE:      ${context.niche}
PORTFOLIO:  ${context.portfolioSummary}

── CUSTOMER AVATARS ──────────────────────────────────────────────

${avatarsBlock}

── BRAND VOICE ───────────────────────────────────────────────────

  Tone:           ${context.brandVoice.tone}
  Speaking Style: ${context.brandVoice.speakingStyle}
  Never Use:      ${(context.brandVoice.doNotUse ?? []).join(', ')}${(context.brandVoice.referenceExamples ?? []).length > 0 ? `\n  Reference Examples:\n${(context.brandVoice.referenceExamples ?? []).map((e) => `    "${e}"`).join('\n')}` : ''}

── PROOF BANK — use only what is listed here ─────────────────────

${proofBankBlock}

── OFFER MECHANICS ───────────────────────────────────────────────

  Product:      ${context.offerMechanics.productName}
  Price:        ${context.offerMechanics.price}
  Guarantee:    ${context.offerMechanics.guarantee}
  Key Benefits: ${(context.offerMechanics.keyBenefits ?? []).join(', ')}
  CTA:          ${context.offerMechanics.cta}
${memoryBlock ? `\n── PREVIOUSLY APPROVED SCRIPTS (avoid repeating these patterns) ──\n\n${memoryBlock}\n` : ''}
━━━ APPROVED IDEA ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${ideaBlock}

${qualityFeedback ? `━━━ QUALITY REVIEW FEEDBACK — previous version was rejected ━━━━━━

A previous version of this script failed the quality review agent.
You MUST address every issue listed below. Do not repeat the same mistakes.

${qualityFeedback}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

` : ''}━━━ SECTION GUIDELINES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HOOK 1, 2, 3  (${dt.hookWords} words each — three distinct opening lines)
  The first 1–2 spoken sentences. Must make the viewer stop scrolling immediately.
  Each hook must approach the same core concept from a completely different angle:
    hook1 — lead with the pain or problem
    hook2 — lead with a result or proof
    hook3 — lead with a curiosity gap or counterintuitive claim

PROBLEM  (${dt.problemWords} words)
  Agitate the pain. Make the target avatar feel completely seen and understood.
  Do not introduce the solution yet. Reference the specific target pain above.
  Use "you" language — speak directly to the viewer.

STORY  (${dt.storyWords} words)
  A narrative bridge from problem to solution. This is where emotional connection happens.
  Options: a brief client scenario, a relatable moment, a surprising insight, a contrast.
  This section must feel real and specific, not generic.

SOLUTION  (${dt.solutionWords} words)
  Introduce ${context.offerMechanics.productName} as the answer. Keep it conversational.
  Name what changes for the viewer if they take action. Do not oversell.
  Let the proof section do the heavy lifting — keep this focused on the transformation.

PROOF  (${dt.proofWords} words)
  Pull ONLY from the proof bank above. Be specific — exact numbers, exact names, exact outcomes.
  Quote or paraphrase directly. Never approximate in a way that changes the meaning.
  If multiple proof points are relevant, prioritise the one most directly tied to the idea's angle.

CTA  (${dt.ctaWords} words)
  One clear, specific, low-friction action. Use the CTA from offer mechanics above.
  Write it as a natural next step — not a command. Avoid "click the link below" clichés.

PRODUCTION NOTES  (optional)
  Brief filming or delivery directions only (e.g. "Speak to camera, no B-roll needed").
  Omit if the script is self-explanatory. Return null if no notes are needed.

SECTION PACING  (one sentence per body section)
  How the speaker should deliver each section: speed, energy level, and emotional tone.
  Be specific to the angle of this idea — not generic advice.
  Examples:
    "Slow and empathetic — let the pain settle before moving on."
    "Pick up pace and confidence as you move through the client results."
    "Drop to a quieter, more personal tone — this is the story, not the pitch."

SECTION VISUALS  (one sentence per body section)
  What the camera shows or what appears on screen during each section.
  Match the creative type: ${idea.creativeType} — tailor every cue to this format.
  Examples:
    "Speaker direct to camera — uncut, no B-roll, raw eye contact."
    "Cut to B-roll: time-lapse of a packed calendar or late-night desk scene."
    "On-screen text overlay: the specific result from the proof bank."

━━━ WORD COUNT CHECKPOINT (complete before writing JSON) ━━━━━━━━

Before writing your response, verify your word counts:
  Hook 1:   ${dt.hookWords} words
  Problem:  ${dt.problemWords} words
  Story:    ${dt.storyWords} words
  Solution: ${dt.solutionWords} words
  Proof:    ${dt.proofWords} words
  CTA:      ${dt.ctaWords} words
  TOTAL:    ${dt.totalWords} words

If any section is too short, expand it. If too long, trim it.
Do not submit until the total is within the required range.

━━━ RESPONSE FORMAT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY valid JSON. No markdown fences. No explanation. No extra fields.
Start with { and end with }.
ALL string fields below are REQUIRED and must be non-empty. Only "productionNotes" may be null.

CRITICAL: problem, story, solution, proof, and cta MUST be nested inside the "body" object.
Do NOT place them at the top level of the JSON.

{
  "hook1": "<first hook — pain/problem led — REQUIRED non-empty string>",
  "hook2": "<second hook — result/proof led — REQUIRED non-empty string>",
  "hook3": "<third hook — curiosity/counterintuitive led — REQUIRED non-empty string>",
  "body": {
    "problem": "<agitate the pain, make viewer feel seen — REQUIRED non-empty string>",
    "story": "<narrative bridge — relatable scenario or insight — REQUIRED non-empty string>",
    "solution": "<introduce the product/transformation — REQUIRED non-empty string>",
    "proof": "<specific proof from the proof bank only — REQUIRED non-empty string>",
    "cta": "<clear, natural call to action — REQUIRED non-empty string>"
  },
  "productionNotes": "<brief filming notes or null>",
  "sectionPacing": {
    "problem": "<one sentence: delivery speed and emotional tone for the problem section>",
    "story": "<one sentence: pacing and energy for the story section>",
    "solution": "<one sentence: pace for the solution reveal>",
    "proof": "<one sentence: delivery energy for citing the proof>",
    "cta": "<one sentence: energy and intention for the call to action>"
  },
  "sectionVisuals": {
    "problem": "<one sentence: what the camera shows or what is on screen during the problem section>",
    "story": "<one sentence: visual direction for the story section>",
    "solution": "<one sentence: visual direction for the solution reveal>",
    "proof": "<one sentence: visual direction while citing the proof>",
    "cta": "<one sentence: visual direction for the call to action>"
  }
}`;
}
