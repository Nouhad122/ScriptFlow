/**
 * IdeaAgent — generates marketing script concepts from a ClientContext.
 *
 * Single responsibility: produce a validated batch of Idea objects.
 * This agent does NOT score, script, review, or deliver anything.
 *
 * HOW THE ORCHESTRATOR WILL CALL THIS AGENT:
 *   const previousIdeas = await memoryAgent.getPreviousIdeas(context.id);
 *   const result = await ideaAgent.generateIdeas(context, previousIdeas);
 *   if (!result.success) { ... handle error }
 *   await memoryAgent.storeIdeas(result.data);
 *   // ideas are now in the dashboard awaiting human approval
 *
 * WHY SCORING IS A SEPARATE AGENT:
 *   Generating ideas and scoring ideas are two distinct responsibilities with
 *   separate prompts and separate purposes. Collapsing them would couple
 *   creative strategy (ideation) with analytical evaluation (ICE scoring),
 *   making it impossible to change one without risking the other.
 *   The assessment brief explicitly flags this as a deliberate two-stage design.
 *
 * WHY THIS AGENT DOESN'T KNOW WHICH AI PROVIDER IS BEING USED:
 *   The agent depends on AIService, not on any specific SDK. If the provider
 *   changes from Gemini to OpenAI or Anthropic, this file stays identical.
 *   Only AIService and its configuration change.
 */

import { randomUUID } from 'crypto';
import type { IIdeaAgent } from './interfaces';
import type { AgentResult, ClientContext, Idea } from '../types';
import { type ApprovalStatus, type CreativeType, type LeadType } from '../types';
import type { AIService } from '../services/AIService';
import { type IdeaAgentConfig, ideaAgentConfig } from '../config/idea.config';
import { buildIdeaPrompt } from '../prompts/idea.prompt';

// ---------------------------------------------------------------------------
// Raw shape returned by the AI provider — uses "concept" per the assessment brief.
// Mapped to the internal Idea type (which uses "hookLine") in mapToIdeas().
// ---------------------------------------------------------------------------

interface RawIdeaFromAI {
  concept: string;
  creativeType: string;
  angle: string;
  leadType: string;
  supportingProof: string;
  targetAvatar: string;
  targetPain: string;
}

const VALID_CREATIVE_TYPES = new Set(['talking-head', 'ugc', 'listicle', 'story', 'demo', 'testimonial']);
const VALID_LEAD_TYPES = new Set(['problem-led', 'proof-led', 'curiosity-led', 'offer-led']);
const REQUIRED_FIELDS: Array<keyof RawIdeaFromAI> = [
  'concept', 'creativeType', 'angle', 'leadType', 'supportingProof', 'targetAvatar', 'targetPain',
];

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateRawIdeas(raw: unknown): RawIdeaFromAI[] {
  if (!Array.isArray(raw)) {
    throw new Error(
      `Expected a JSON array from the AI provider but received: ${typeof raw}`
    );
  }
  if (raw.length === 0) {
    throw new Error('AI provider returned an empty ideas array');
  }

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i] as Record<string, unknown>;

    for (const field of REQUIRED_FIELDS) {
      const value = item[field];
      if (!value || typeof value !== 'string' || value.trim() === '') {
        throw new Error(
          `Idea at index ${i} is missing or has an empty required field: "${field}"`
        );
      }
    }

    if (!VALID_CREATIVE_TYPES.has(item.creativeType as string)) {
      throw new Error(
        `Idea at index ${i} has an invalid creativeType: "${item.creativeType}". ` +
          `Valid values: ${[...VALID_CREATIVE_TYPES].join(', ')}`
      );
    }

    if (!VALID_LEAD_TYPES.has(item.leadType as string)) {
      throw new Error(
        `Idea at index ${i} has an invalid leadType: "${item.leadType}". ` +
          `Valid values: ${[...VALID_LEAD_TYPES].join(', ')}`
      );
    }
  }

  // Duplicate concept check (case-insensitive)
  const seen = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const idea = raw[i] as RawIdeaFromAI;
    const normalised = idea.concept.toLowerCase().trim();
    if (seen.has(normalised)) {
      throw new Error(
        `Duplicate concept detected at index ${i}: "${idea.concept}"`
      );
    }
    seen.add(normalised);
  }

  return raw as RawIdeaFromAI[];
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function mapToIdeas(raw: RawIdeaFromAI[], clientId: string): Idea[] {
  return raw.map((r) => ({
    id: randomUUID(),
    clientId,
    pipelineRunId: '', // assigned by the orchestrator once pipeline runs are implemented
    hookLine: r.concept,
    creativeType: r.creativeType as CreativeType,
    angle: r.angle,
    leadType: r.leadType as LeadType,
    supportingProofPoints: [r.supportingProof],
    targetAvatar: r.targetAvatar,
    targetPain: r.targetPain,
    iceScore: null,
    approvalStatus: 'pending' as ApprovalStatus,
    approvedAt: null,
    approvedBy: null,
    createdAt: new Date(),
  }));
}

// ---------------------------------------------------------------------------
// Agent
// ---------------------------------------------------------------------------

export class IdeaAgent implements IIdeaAgent {
  private readonly ai: AIService;
  private readonly config: IdeaAgentConfig;

  constructor(ai: AIService, config: IdeaAgentConfig = ideaAgentConfig) {
    this.ai = ai;
    this.config = config;
  }

  async generateIdeas(
    context: ClientContext,
    previousIdeas: Idea[]
  ): Promise<AgentResult<Idea[]>> {
    const start = Date.now();

    try {
      const prompt = buildIdeaPrompt(
        context,
        this.config.ideaCount,
        previousIdeas,
        this.config.creativityLevel
      );

      const raw = await this.ai.generateStructured<RawIdeaFromAI[]>(prompt);
      const validated = validateRawIdeas(raw);
      const ideas = mapToIdeas(validated, context.id);

      return {
        success: true,
        data: ideas,
        agentName: 'IdeaAgent',
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error in IdeaAgent',
        agentName: 'IdeaAgent',
        durationMs: Date.now() - start,
      };
    }
  }
}
