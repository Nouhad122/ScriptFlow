/**
 * Idea generation prompt — the only place where creative strategy for ideas is encoded.
 *
 * This file is intentionally separated from IdeaAgent.ts so that:
 *   1. The prompt can be iterated without touching agent logic.
 *   2. The agent file stays focused on orchestration, validation, and mapping.
 *   3. Prompts for different agents never bleed into each other.
 *
 * The function receives runtime data (client context, count, history) and
 * returns a fully assembled prompt string ready for AIService.
 */

import type { ClientContext, Idea } from '../types';
import type { CreativityLevel } from '../config/idea.config';
import type { MemoryMatch } from '../memory/types';

const CREATIVITY_INSTRUCTION: Record<CreativityLevel, string> = {
  focused:
    'Focus on the highest-converting proven angles for this niche. Prioritise clarity and directness over novelty.',
  balanced:
    'Balance proven direct-response angles with fresh perspectives. Mix familiar structures with unexpected hooks.',
  experimental:
    'Push creative boundaries. Use unexpected angles, counterintuitive hooks, and formats the target audience has not seen before.',
};

function buildMemorySection(matches: MemoryMatch[]): string {
  if (matches.length === 0) return '';

  const matchBlocks = matches
    .map(
      (m, i) =>
        `MATCH ${i + 1} [${m.sourceType.toUpperCase()}] (similarity: ${(m.similarity * 100).toFixed(0)}%)\n` +
        m.text
          .split('\n')
          .map((line) => `  ${line}`)
          .join('\n')
    )
    .join('\n\n');

  return (
    `━━━ PREVIOUSLY APPROVED CONTENT FROM MEMORY (${matches.length} match${matches.length === 1 ? '' : 'es'}) ━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    matchBlocks +
    '\n\nDIVERSITY INSTRUCTIONS:\n' +
    '  • Do NOT copy or closely paraphrase any hook, angle, or narrative above.\n' +
    '  • You MAY revisit a successful theme only if you approach it from a different avatar, creative format, or lead type.\n' +
    '  • NEVER repeat a hook verbatim.\n' +
    '  • Use this section as a map of what has already worked — generate what is genuinely new.\n\n'
  );
}

export function buildIdeaPrompt(
  context: ClientContext,
  count: number,
  previousIdeas: Idea[],
  creativityLevel: CreativityLevel,
  memoryMatches?: MemoryMatch[]
): string {
  const avatarsBlock = context.avatars
    .map(
      (a) =>
        `  Avatar: ${a.name}\n  Pains: ${a.pains.join(' | ')}\n  Desires: ${a.desires.join(' | ')}`
    )
    .join('\n\n');

  const proofBankBlock = context.proofBank
    .map((p) => `  [${p.type.toUpperCase()}] ${p.content}  (Source: ${p.source})`)
    .join('\n');

  const previousBlock =
    previousIdeas.length > 0
      ? previousIdeas.map((i) => `  - "${i.hookLine}"`).join('\n')
      : '  None.';

  const memorySection = buildMemorySection(memoryMatches ?? []);

  return `You are a world-class direct-response video ad strategist specialising in high-ticket online business coaching.

Your task: generate exactly ${count} unique marketing script concepts for the client below.

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
  Key Benefits:   ${context.offerMechanics.keyBenefits.join(', ')}
  CTA:            ${context.offerMechanics.cta}

── PROOF BANK (USE ONLY THESE — NEVER FABRICATE) ─────────────────

${proofBankBlock}

── BRAND VOICE ───────────────────────────────────────────────────

  Tone:           ${context.brandVoice.tone}
  Speaking Style: ${context.brandVoice.speakingStyle}
  Never Use:      ${context.brandVoice.doNotUse.join(', ')}

━━━ PREVIOUSLY GENERATED CONCEPTS (DO NOT REPEAT) ━━━━━━━━━━━━━━

${previousBlock}

${memorySection}━━━ YOUR INSTRUCTIONS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate exactly ${count} distinct script concepts. ${CREATIVITY_INSTRUCTION[creativityLevel]}

Each concept must:
  • Target a specific avatar by name and address one of their specific pains
  • Use a hook that stops the scroll in the first 3 seconds
  • Be meaningfully different from every other concept in this batch
  • Use a different creativeType and leadType where possible across the batch

━━━ ABSOLUTE RULES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. NEVER fabricate proof, results, statistics, or client names.
   The "supportingProof" field MUST be taken verbatim from the Proof Bank above.
   If no proof fits exactly, use the closest real entry — do NOT invent one.

2. Do NOT repeat any concept from the "Previously Generated Concepts" list.

3. Generate EXACTLY ${count} ideas — no more, no fewer.

4. Every concept in this batch must be meaningfully distinct.
   Two ideas that feel like variations of the same hook count as duplicates.

━━━ AVAILABLE FIELD VALUES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

creativeType — use as many different values as possible across the batch:
  talking-head  → host speaks directly to camera
  ugc           → casual first-person, user-generated style
  listicle      → numbered list format ("3 reasons why...")
  story         → narrative arc with transformation
  demo          → shows a process, tool, or result in action
  testimonial   → a specific client result as the hero of the ad

leadType — pick whichever fits the angle:
  problem-led   → open with the pain or problem
  proof-led     → open with a result or credential
  curiosity-led → open with a hook that creates a knowledge gap
  offer-led     → open with the outcome or the offer itself

━━━ RESPONSE FORMAT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY a valid JSON array. No markdown code blocks. No explanation.
Start your response with [ and end with ].

Each object must match this exact schema — all fields are required strings:

{
  "concept":        "<the specific opening hook line — what the ad literally opens with>",
  "creativeType":   "<one value from the creativeType list above>",
  "angle":          "<the persuasion angle, e.g. 'authority proof', 'pain amplification', 'curiosity gap', 'transformation story', 'social proof cascade'>",
  "leadType":       "<one value from the leadType list above>",
  "supportingProof":"<copied verbatim from the Proof Bank — no paraphrasing>",
  "targetAvatar":   "<exact avatar name from the Client Context>",
  "targetPain":     "<the specific pain point from that avatar's pain list>"
}`;
}
