/**
 * ScriptAgent — transforms one approved idea into a production-ready script.
 *
 * Single responsibility: generate a structured script from an approved idea.
 * This agent does NOT generate ideas, score ideas, review quality, or deliver files.
 *
 * WHY ONLY APPROVED IDEAS:
 *   The human approval gate is the quality checkpoint between idea generation and
 *   script production. Allowing pending or rejected ideas to enter script generation
 *   would waste AI spend and produce content the client never requested. The check
 *   is enforced here (agent level) AND in the controller (HTTP level) — if the
 *   controller is bypassed, the agent still refuses.
 *
 * WHY THREE HOOKS:
 *   The assessment brief (Section 3) requires three hook options. A single hook
 *   limits the client's A/B testing flexibility. Three hooks, each approaching the
 *   concept from a different angle (pain-led, proof-led, curiosity-led), give the
 *   content director real creative options.
 *
 * WHY memoryContext IS PASSED BUT CAN BE EMPTY:
 *   Passing [] is valid — the prompt omits the memory section gracefully when the
 *   array is empty. No empty-array guard needed in the agent.
 */

import { randomUUID } from 'crypto';
import type { IScriptAgent } from './interfaces';
import type { AgentResult, ClientContext, Idea, Script, SectionNotes, VideoDuration } from '../types';
import type { AIService } from '../services/AIService';
import { type ScriptAgentConfig, scriptAgentConfig } from '../config/script.config';
import { buildScriptPrompt } from '../prompts/script.prompt';

// ---------------------------------------------------------------------------
// Raw shape returned by the AI before validation and mapping
// ---------------------------------------------------------------------------

interface RawScriptBody {
  problem: string;
  story: string;
  solution: string;
  proof: string;
  cta: string;
}

interface RawScriptFromAI {
  hook1: string;
  hook2: string;
  hook3: string;
  body: RawScriptBody;
  productionNotes?: string | null;
  sectionPacing?: SectionNotes | null;
  sectionVisuals?: SectionNotes | null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function assertNonEmptyString(value: unknown, fieldPath: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(
      `Script field "${fieldPath}" is missing or empty. The AI must return a non-empty string for every section.`
    );
  }
}

function validateRawScript(raw: unknown): RawScriptFromAI {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(
      `Expected a JSON object from the AI but received: ${Array.isArray(raw) ? 'array' : typeof raw}`
    );
  }

  const r = raw as Record<string, unknown>;

  // Recovery: model sometimes returns body fields at the top level instead of nested.
  // Reconstruct the body object so validation can continue.
  if ((!r['body'] || typeof r['body'] !== 'object') &&
      r['problem'] && r['story'] && r['solution'] && r['proof'] && r['cta']) {
    r['body'] = {
      problem:  r['problem'],
      story:    r['story'],
      solution: r['solution'],
      proof:    r['proof'],
      cta:      r['cta'],
    };
  }

  const body = r['body'] as Record<string, unknown> | undefined;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Script response is missing the "body" object');
  }

  assertNonEmptyString(r['hook1'], 'hook1');
  assertNonEmptyString(r['hook2'], 'hook2');
  assertNonEmptyString(r['hook3'], 'hook3');
  assertNonEmptyString(body['problem'], 'body.problem');
  assertNonEmptyString(body['story'], 'body.story');
  assertNonEmptyString(body['solution'], 'body.solution');
  assertNonEmptyString(body['proof'], 'body.proof');
  assertNonEmptyString(body['cta'], 'body.cta');

  // sectionPacing and sectionVisuals are optional but validated when present.
  const SECTION_KEYS = ['problem', 'story', 'solution', 'proof', 'cta'] as const;
  for (const field of ['sectionPacing', 'sectionVisuals'] as const) {
    const obj = r[field];
    if (obj != null) {
      if (typeof obj !== 'object' || Array.isArray(obj)) {
        throw new Error(`"${field}" must be an object if present`);
      }
      const o = obj as Record<string, unknown>;
      for (const key of SECTION_KEYS) {
        assertNonEmptyString(o[key], `${field}.${key}`);
      }
    }
  }

  return r as unknown as RawScriptFromAI;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function mapToScript(raw: RawScriptFromAI, idea: Idea): Script {
  return {
    id: randomUUID(),
    ideaId: idea.id,
    clientId: idea.clientId,
    pipelineRunId: idea.pipelineRunId,
    hook1: raw.hook1.trim(),
    hook2: raw.hook2.trim(),
    hook3: raw.hook3.trim(),
    body: {
      problem: raw.body.problem.trim(),
      story: raw.body.story.trim(),
      solution: raw.body.solution.trim(),
      proof: raw.body.proof.trim(),
      cta: raw.body.cta.trim(),
    },
    productionNotes: raw.productionNotes ? raw.productionNotes.trim() : null,
    sectionPacing:   raw.sectionPacing  ?? null,
    sectionVisuals:  raw.sectionVisuals ?? null,
    status: 'pending_review',
    deliveredAt: null,
    outputPath: null,
    createdAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class ScriptAgent implements IScriptAgent {
  private readonly ai: AIService;
  private readonly config: ScriptAgentConfig;

  constructor(ai: AIService, config: ScriptAgentConfig = scriptAgentConfig) {
    this.ai = ai;
    this.config = config;
  }

  async generateScript(
    idea: Idea,
    context: ClientContext,
    memoryContext: Script[],
    qualityFeedback?: string,
    videoDuration?: VideoDuration
  ): Promise<AgentResult<Script>> {
    const start = Date.now();

    // Domain invariant: only approved ideas can become scripts.
    // This check lives here (not just in the controller) because the agent may be
    // called directly by the orchestrator, bypassing the HTTP layer entirely.
    if (idea.approvalStatus !== 'approved') {
      return {
        success: false,
        error:
          `Script generation requires an approved idea. ` +
          `Current status: "${idea.approvalStatus}". ` +
          `Approve the idea via PATCH /api/ideas/${idea.id}/approval before generating a script.`,
        agentName: 'ScriptAgent',
        durationMs: 0,
      };
    }

    const MAX_ATTEMPTS = 2;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const prompt = buildScriptPrompt(idea, context, memoryContext, qualityFeedback, videoDuration);
        const raw = await this.ai.generateStructured<RawScriptFromAI>(prompt);
        const validated = validateRawScript(raw);
        const script = mapToScript(validated, idea);

        return {
          success: true,
          data: script,
          agentName: 'ScriptAgent',
          durationMs: Date.now() - start,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error in ScriptAgent');
        // On the last attempt, stop retrying and fall through to failure return.
      }
    }

    return {
      success: false,
      error: lastError?.message ?? 'Unknown error in ScriptAgent',
      agentName: 'ScriptAgent',
      durationMs: Date.now() - start,
    };
  }
}
