/**
 * MemoryWriteService — the single entry point for storing content in semantic memory.
 *
 * WHY THIS SERVICE EXISTS:
 *   Controllers know about domain objects (Idea, Script). They should not know about
 *   embedding dimensions, text composition strategy, or repository serialisation.
 *   MemoryWriteService hides all of that behind two methods that speak domain language:
 *   "remember this approved idea" and "remember this generated script."
 *
 * NON-BLOCKING CONTRACT:
 *   Both public methods catch ALL errors internally and log them. They never re-throw.
 *   Callers can fire-and-forget with `void service.rememberApprovedIdea(idea)` and
 *   the primary user-facing operation is guaranteed to succeed even when memory fails.
 *
 * DUPLICATE SAFETY:
 *   The repository uses INSERT OR IGNORE backed by a UNIQUE INDEX on
 *   (source_type, source_id). Calling either method twice for the same content is safe —
 *   the second write is silently discarded at the database level.
 *
 * MISSING API KEY:
 *   If OPENROUTER_API_KEY is absent, createMemoryWriteService() returns null.
 *   Callers use optional chaining: `void getMemoryWriteService()?.rememberApprovedIdea(idea)`.
 *   No memory writes happen; the rest of the application is unaffected.
 */

import { randomUUID } from 'crypto';
import { EmbeddingService } from './EmbeddingService';
import { MemoryRepository, createMemoryRepository } from './MemoryRepository';
import { OpenRouterEmbeddingProvider } from './OpenRouterEmbeddingProvider';
import { env } from '../config/env';
import type { Idea } from '../types/idea.types';
import type { Script } from '../types/script.types';

// ---------------------------------------------------------------------------
// Text composition helpers
//
// These produce the string stored in memory_entries.text for human-readable
// provenance alongside the embedding vector. They deliberately match what
// EmbeddingService sends to the provider so the stored text and the embedding
// represent the same content. If embedding text composition is later tuned
// separately, update both.
// ---------------------------------------------------------------------------

function composeIdeaText(idea: Idea): string {
  const lines: string[] = [
    `Hook: ${idea.hookLine}`,
    `Type: ${idea.creativeType}`,
    `Angle: ${idea.angle}`,
    `Lead: ${idea.leadType}`,
    `Avatar: ${idea.targetAvatar}`,
    `Pain: ${idea.targetPain}`,
  ];
  if (idea.supportingProofPoints.length > 0) {
    lines.push(`Proof: ${idea.supportingProofPoints.join('; ')}`);
  }
  return lines.join('\n');
}

function composeScriptText(script: Script): string {
  return [
    `Hook: ${script.hook1}`,
    `Problem: ${script.body.problem}`,
    `Story: ${script.body.story}`,
    `Solution: ${script.body.solution}`,
    `Proof: ${script.body.proof}`,
    `CTA: ${script.body.cta}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class MemoryWriteService {
  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly repository: MemoryRepository
  ) {}

  /**
   * Embeds an approved idea and stores it in memory_entries.
   * Errors are caught and logged — this method never rejects.
   */
  async rememberApprovedIdea(idea: Idea): Promise<void> {
    try {
      const embedding = await this.embeddingService.embedIdea(idea);
      await this.repository.saveEntry({
        id: randomUUID(),
        sourceType: 'idea',
        sourceId: idea.id,
        clientId: idea.clientId,
        pipelineRunId: idea.pipelineRunId,
        text: composeIdeaText(idea),
        embeddingModel: this.embeddingService.modelName,
        embedding,
        createdAt: new Date(),
      });
    } catch (err) {
      console.error(
        '[Memory] Failed to store approved idea %s:',
        idea.id,
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  /**
   * Embeds a generated script and stores it in memory_entries.
   * The idea is provided to supply clientId when script.clientId is absent
   * (defensive — Script always carries clientId in the current schema).
   * Errors are caught and logged — this method never rejects.
   */
  async rememberGeneratedScript(script: Script, idea: Idea): Promise<void> {
    try {
      const embedding = await this.embeddingService.embedScript(script);
      await this.repository.saveEntry({
        id: randomUUID(),
        sourceType: 'script',
        sourceId: script.id,
        clientId: script.clientId || idea.clientId,
        pipelineRunId: script.pipelineRunId,
        text: composeScriptText(script),
        embeddingModel: this.embeddingService.modelName,
        embedding,
        createdAt: new Date(),
      });
    } catch (err) {
      console.error(
        '[Memory] Failed to store generated script %s:',
        script.id,
        err instanceof Error ? err.message : String(err)
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a MemoryWriteService for the given OpenRouter API key.
 * Returns null if the key is blank — callers can skip memory writes safely.
 * Exported for unit testing without touching the module-level singleton.
 */
export function createMemoryWriteService(openrouterApiKey: string): MemoryWriteService | null {
  const key = openrouterApiKey?.trim();
  if (!key) {
    console.warn(
      '[Memory] OPENROUTER_API_KEY is not set — memory writes are disabled. ' +
        'Semantic memory will not be populated until the key is added to .env.'
    );
    return null;
  }
  try {
    const provider = new OpenRouterEmbeddingProvider(key);
    const embeddingService = new EmbeddingService(provider);
    const repository = createMemoryRepository();
    return new MemoryWriteService(embeddingService, repository);
  } catch (err) {
    console.warn(
      '[Memory] Failed to initialise MemoryWriteService:',
      err instanceof Error ? err.message : String(err)
    );
    return null;
  }
}

// ---------------------------------------------------------------------------
// Lazy singleton
// ---------------------------------------------------------------------------

// `undefined` = not yet initialised; `null` = key absent or init failed; instance = ready
let _instance: MemoryWriteService | null | undefined = undefined;

/**
 * Returns the shared MemoryWriteService instance, initialised on first call.
 * Returns null when OPENROUTER_API_KEY is missing — callers use optional chaining:
 *   void getMemoryWriteService()?.rememberApprovedIdea(idea)
 */
export function getMemoryWriteService(): MemoryWriteService | null {
  if (_instance !== undefined) return _instance;
  _instance = createMemoryWriteService(env.openrouterApiKey);
  return _instance;
}
