/**
 * EmbeddingService — converts domain objects into numeric vectors for storage and retrieval.
 *
 * RESPONSIBILITIES:
 *   - Compose a text representation from each domain object's fields
 *   - Delegate the actual embedding call to the injected IEmbeddingProvider
 *   - Return the raw numeric vector (persistence is the repository's job)
 *
 * WHY A SEPARATE TEXT COMPOSITION STEP:
 *   An embedding is only as good as the text fed to it. Which fields to include,
 *   in what order, and with what labels is a design decision separate from the API
 *   call. EmbeddingService owns that strategy so it can be tuned independently of
 *   OpenRouterEmbeddingProvider. For example, we might later weight the hook line more
 *   heavily by repeating it, or drop production_notes because they add noise.
 *
 * FIELD SELECTION RATIONALE:
 *   embedIdea: all seven semantically rich fields — hookLine, angle, creativeType,
 *     leadType, targetAvatar, targetPain, and supportingProofPoints. Together they
 *     describe the "who, what, how" of the content idea without structured metadata
 *     (ids, timestamps) that would dilute the semantic signal.
 *
 *   embedScript: primary hook (hook1) plus all five body sections. Hook1 carries
 *     the narrative identity. The body sections carry the full argument arc:
 *     problem → story → solution → proof → CTA. Together they describe how the
 *     idea was actually executed.
 */

import type { IEmbeddingProvider } from './EmbeddingProvider';
import type { Idea } from '../types/idea.types';
import type { Script } from '../types/script.types';

export class EmbeddingService {
  constructor(private readonly provider: IEmbeddingProvider) {}

  get modelName(): string {
    return this.provider.modelName;
  }

  async embedIdea(idea: Idea): Promise<number[]> {
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

    return this.provider.embed(lines.join('\n'));
  }

  /** Embeds an arbitrary text string using the same model as embedIdea/embedScript. */
  async embedText(text: string): Promise<number[]> {
    return this.provider.embed(text);
  }

  async embedScript(script: Script): Promise<number[]> {
    const text = [
      `Hook: ${script.hook1}`,
      `Problem: ${script.body.problem}`,
      `Story: ${script.body.story}`,
      `Solution: ${script.body.solution}`,
      `Proof: ${script.body.proof}`,
      `CTA: ${script.body.cta}`,
    ].join('\n');

    return this.provider.embed(text);
  }
}
