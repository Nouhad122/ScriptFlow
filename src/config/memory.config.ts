/**
 * Configuration for Memory Search.
 *
 * WHY MEMORY SEARCH AND DUPLICATE DETECTION REQUIRE DIFFERENT THRESHOLDS:
 *
 *   Memory Search is about semantic inspiration — finding previously approved
 *   content that is thematically related to the current client context so the
 *   Idea Agent can diversify away from angles already covered. A match does not
 *   need to be identical or even very close; it needs to be relevant. A threshold
 *   of 0.60 correctly captures "semantically related marketing content in the same
 *   niche" without being so strict that it misses genuinely useful context.
 *
 *   Duplicate Detection, by contrast, requires a threshold of 0.85+ because the
 *   goal is to identify content that is functionally identical — same hook reworded,
 *   same angle in a different format. At 0.85 the model is highly confident the two
 *   texts say the same thing. Using 0.85 for Memory Search would surface only near-
 *   duplicates, which defeats the purpose (the agent would still repeat angles it
 *   does not know about). Using 0.60 for Duplicate Detection would flag unrelated
 *   but topically adjacent content as duplicates, producing false positives.
 *
 * threshold — Minimum cosine similarity for a memory entry to be returned.
 *   0.60 is appropriate for "semantically inspired by the same niche/audience."
 *   Raise toward 0.85 only if implementing duplicate detection, not here.
 *
 * topK — Maximum number of matches returned per search. Kept at 5 to avoid
 *   flooding the idea prompt with historical context that crowds out new angles.
 */

export interface MemorySearchConfig {
  threshold: number;
  topK: number;
}

export const memorySearchConfig: MemorySearchConfig = {
  threshold: 0.60,
  topK: 5,
};
