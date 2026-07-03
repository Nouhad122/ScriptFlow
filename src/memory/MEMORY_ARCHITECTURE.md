# Memory Module Architecture

This document explains the four key design decisions in `src/memory/`.

---

## 1. Why embeddings are abstracted behind `IEmbeddingProvider`

Embedding vendors differ in API shape, vector dimension, pricing, quality, and rate limits:

| Provider | Model | Dimensions | Best for |
|---|---|---|---|
| Voyage AI | `voyage-3-lite` | 512 | General content, fast |
| Voyage AI | `voyage-3` | 1024 | Higher quality retrieval |
| OpenAI | `text-embedding-3-small` | 1536 | When already on OpenAI |
| Cohere | `embed-english-v3.0` | 1024 | Multilingual support |

Tying the application directly to the `voyageai` SDK would mean touching
`EmbeddingService` and every call site when switching providers. The
`IEmbeddingProvider` interface exposes only what the memory module needs:

```typescript
interface IEmbeddingProvider {
  readonly modelName: string;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
```

`VoyageEmbeddingProvider` implements this interface. `EmbeddingService` and
`MemoryRepository` depend only on `IEmbeddingProvider`. To swap providers:

1. Create a new class implementing `IEmbeddingProvider`.
2. Update the singleton instantiation in the Memory Agent.
3. Re-embed stored entries (model change = incompatible vectors).

Zero changes to `SimilaritySearch`, `MemoryRepository`, or any agent.

This mirrors the `AIService` pattern used for text generation throughout V1.

---

## 2. Why `SimilaritySearch` is separate from `MemoryRepository`

These are two independent concerns composed by the Memory Agent:

```
Memory Agent
    │
    ├── MemoryRepository.getEntriesByClient(clientId)
    │       → MemoryEntry[]          (I/O concern)
    │
    └── SimilaritySearch.findMostSimilar(query, entries, topK)
            → SimilarityResult[]     (math concern)
```

**Benefits of separation:**

- `SimilaritySearch` is a pure function — no database, no provider, no async I/O.
  It can be unit-tested with plain arrays in microseconds.

- `MemoryRepository` can be swapped for a vector database without changing the
  ranking math. The Memory Agent re-wires which data source feeds the search.

- Future features (re-ranking by date, filtering by sourceType before scoring,
  score thresholding) are added as steps in the Memory Agent, not by merging
  logic into either class.

- `cosineSimilarity` is exported as a standalone function so it can be reused
  in evaluation scripts, batch re-scoring jobs, or future quality metrics.

---

## 3. Why local cosine similarity is sufficient for Version 2

**Scale argument:** A pipeline run generates 5–10 ideas and 0–5 scripts.
After 100 runs the memory table holds at most 1,500 entries.

**Performance measurement:** Scoring 1,500 entries with 512-dimensional vectors
in a JavaScript loop:

```
Operations: 1,500 × 512 multiplications = 768,000 FP ops
On a modern CPU at ~1 billion FP ops/sec: < 1 ms
```

**Comparison with alternatives at V2 scale:**

| Approach | Latency | Complexity |
|---|---|---|
| In-process JS loop | < 1 ms | Zero setup |
| sqlite-vec extension | ~0.5 ms | OS-level native compilation |
| Pinecone / Qdrant | 20–100 ms network | New service, schema migration |

The network round-trip to a vector database alone would be 20–100× slower than
the in-process loop at this data volume. sqlite-vec requires the native
`libsqlite3-vec.dylib` / `.dll` / `.so` which adds OS-specific build steps.

The in-process approach scales to ~100,000 entries before it becomes worth
profiling. ScriptFlow V2 will not reach that threshold.

---

## 4. How to replace the similarity search later

### Option A — sqlite-vec (stays in SQLite, math moves to C)

1. Add a native BLOB column to `memory_entries`:
   ```sql
   ALTER TABLE memory_entries ADD COLUMN embedding_vec BLOB;
   ```

2. Load the sqlite-vec extension at startup (one line in `connection.ts`):
   ```typescript
   await db.execute("SELECT load_extension('libsqlite3-vec')");
   ```

3. On insert, populate `embedding_vec` from the JSON column:
   ```sql
   INSERT INTO memory_entries (..., embedding_vec)
   VALUES (..., vec_from_json(?))
   ```

4. Replace `SimilaritySearch.findMostSimilar` with a SQL query:
   ```sql
   SELECT *, vec_distance_cosine(embedding_vec, vec_from_json(?)) AS score
   FROM memory_entries
   WHERE client_id = ?
   ORDER BY score ASC
   LIMIT ?
   ```

   Note: sqlite-vec uses distance (lower = closer), not similarity (higher = closer).
   Invert the sort direction.

5. The `Memory Agent` interface stays identical — it still receives `MemoryEntry[]`
   and `SimilarityResult[]`. Only `MemoryRepository` and `SimilaritySearch` change.

**When to choose this:** When entries grow beyond ~50,000 or when the app needs
ANN (approximate nearest neighbour) rather than exact cosine search.

---

### Option B — Dedicated vector database (Pinecone, Qdrant, Weaviate)

1. Route `MemoryRepository.saveEntry()` to upsert into the vector DB:
   ```typescript
   await pineconeIndex.upsert([{
     id: entry.id,
     values: entry.embedding,
     metadata: { clientId, sourceType, sourceId, pipelineRunId }
   }]);
   // Also write metadata to SQLite for relational queries
   await sqliteRepo.saveMetadata(entry);
   ```

2. Route `findMostSimilar()` to query the vector DB:
   ```typescript
   const matches = await pineconeIndex.query({
     vector: queryEmbedding,
     topK,
     filter: { clientId }
   });
   // Resolve full MemoryEntry objects from SQLite by ID
   return sqliteRepo.getByIds(matches.map(m => m.id));
   ```

3. `SimilaritySearch` becomes a thin client wrapper or is removed entirely.

**When to choose this:** When the team needs approximate nearest-neighbour
at millions-of-entries scale, needs hybrid search (vector + keyword), or
needs multi-tenant isolation with enterprise SLA guarantees.

---

## Module structure

```
src/memory/
  types.ts                    MemoryEntry, SimilarityResult, EmbeddingProviderError
  EmbeddingProvider.ts        IEmbeddingProvider interface
  VoyageEmbeddingProvider.ts  Voyage AI implementation
  SimilaritySearch.ts         cosineSimilarity(), SimilaritySearch class
  EmbeddingService.ts         embedIdea(), embedScript()
  MemoryRepository.ts         saveEntry(), getAllEntries(), getEntriesByClient()
  index.ts                    Public re-exports (the module's API surface)
  __tests__/
    similarity.test.ts        Pure math tests — no DB, no provider
    embedding.service.test.ts Mock provider tests — no DB, no network
    memory.repository.test.ts In-memory SQLite integration tests
  MEMORY_ARCHITECTURE.md      This document
```

Nothing outside `src/memory/` imports from this module in V2.
The Memory Agent (V2 Phase 2) will be the sole external consumer.
