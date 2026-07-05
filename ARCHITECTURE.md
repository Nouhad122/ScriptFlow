# ScriptFlow — Architecture

## System Overview

ScriptFlow is a multi-agent AI pipeline for generating, scoring, and reviewing short-form video scripts. A single HTTP request (`POST /api/pipeline/run`) triggers a sequence of AI agents coordinated by the `PipelineOrchestrator`. No agent calls another agent directly; the orchestrator owns the sequence.

```
┌─────────────────────────────────────────────────────────────────────┐
│  React Frontend  (Vite + Tailwind CSS v4)                           │
│  Automation · Idea Intelligence · Content Studio · Quality Center   │
│  History · Memory Explorer · Overview Dashboard                     │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP / JSON
┌───────────────────────────────▼─────────────────────────────────────┐
│  Express API  (Node.js / TypeScript)                                │
│  /api/pipeline  /api/ideas  /api/scripts  /api/memory               │
│  /api/dashboard  /api/health                                        │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│  PipelineOrchestrator                                               │
│  (sequences agents, never calls AI directly)                        │
│                                                                     │
│  MemorySearchService ──► IdeaAgent ──► IceScoringAgent              │
│                                │                                    │
│                          saveIdeas()                                │
└─────────────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│  AIService  (provider-agnostic abstraction)                         │
│  OpenRouter (chat completions) · OpenRouter (embeddings)            │
└─────────────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│  LibSQL / SQLite Database                                           │
│  ideas · scripts · quality_reviews · pipeline_runs · memory_entries│
└─────────────────────────────────────────────────────────────────────┘
```

---

## Agent Architecture

All agents implement interfaces defined in `src/agents/interfaces.ts`. The orchestrator depends only on these interfaces — never on concrete implementations. Swapping a model or provider touches one file.

### Design rules (enforced in `PipelineOrchestrator`)

1. The orchestrator **never** calls `AIService` or OpenRouter directly.
2. The orchestrator **never** contains prompt text.
3. Each agent is a pure `input → output` function with no knowledge of adjacent agents.
4. `pipelineRunId` is assigned by the orchestrator, not by any agent.

### Agents

| Agent | Interface | Responsibility |
|---|---|---|
| `IdeaAgent` | `IIdeaAgent` | Generates raw script concepts from `ClientContext` and memory matches |
| `IceScoringAgent` | `IIceScoringAgent` | Scores each idea on Impact, Confidence, and Ease; attaches `IceScore` |
| `ScriptAgent` | `IScriptAgent` | Generates a production-ready script from one approved idea |
| `QualityReviewAgent` | `IQualityReviewAgent` | Evaluates a script against 10 checklist items; returns `QualityReview` |
| `DeliveryAgent` | `IDeliveryAgent` | Formats a passing script as Markdown and writes it to the output folder |
| `MemoryAgent` | `IMemoryAgent` | Persistence façade for historical ideas and approved scripts |

`ScriptAgent`, `QualityReviewAgent`, and `DeliveryAgent` are implemented and accessible via `/api/scripts` but are not yet wired into the orchestrator's automated flow — `processApprovedIdea()` is planned for Phase 7–10.

### AIService abstraction

```
IdeaAgent / IceScoringAgent / QualityReviewAgent
         │
         └── AIService (src/services/ai.service.ts)
                  │
                  └── OpenAI SDK → https://openrouter.ai/api/v1
                       model: configurable per agent (idea.config.ts, ice.config.ts, …)
```

Changing the model used for idea generation means editing `idea.config.ts` — nothing else.

---

## Memory Architecture

### Purpose

Before each pipeline run, `MemorySearchService` retrieves the most semantically similar approved ideas from previous runs. `IdeaAgent` uses these matches to avoid repeating content and to maintain diversity across runs.

### Write path

```
Idea approved (manual) → MemoryWriteService.rememberApprovedIdea()
Script generated       → MemoryWriteService.rememberGeneratedScript()
                              │
                    EmbeddingService.embedIdea / embedScript()
                              │
                    OpenRouterEmbeddingProvider
                    (openai/text-embedding-3-small via OpenRouter)
                              │
                    MemoryRepository.saveEntry()
                    (INSERT OR IGNORE — idempotent)
```

### Search path

```
POST /api/pipeline/run
  → MemorySearchService.findSimilarContent(clientContext)
        │
        ├── composeClientQuery() — Target Avatar / Pain / Desire / Offer / Content Goal
        ├── EmbeddingService.embedText(query)
        ├── MemoryRepository.getEntriesByClient(clientId)
        └── SimilaritySearch.findMostSimilar() — cosine similarity, in-process
              │
              filter: score >= 0.60  (memorySearchConfig.threshold)
              topK:   5              (memorySearchConfig.topK)
              │
        → MemoryMatch[]  { sourceType, sourceId, similarity, aboveThreshold, text }
```

### Key design decisions

**IEmbeddingProvider abstraction** — `EmbeddingService` and `MemoryRepository` are unaware of the concrete provider. Swapping to a different embedding model or vendor touches only the provider file.

**Client-scoped search** — every query filters by `clientId`. Content produced for one client is never returned as context for a different client.

**In-process cosine similarity** — at the current scale (~5–10 ideas per run, ~1,500 entries maximum), scoring vectors locally completes in under 1 ms. The upgrade path to `sqlite-vec` or Pinecone is documented in `src/memory/SimilaritySearch.ts`.

**Separate thresholds for search vs. deduplication** — memory search uses 0.60 (semantic inspiration), while duplicate detection requires 0.85+ (near-identical content). These are different problems requiring different calibration.

---

## Pipeline Flow

### Stage 1 — `generateAndScoreIdeas(clientContext)`

```
1. Assign pipelineRunId (UUID)

2. MemorySearch (non-blocking — failure logs a warning and continues)
   └── MemorySearchService.findSimilarContent(clientContext)
       └── returns MemoryMatch[] (empty on failure)

3. IdeaGeneration
   └── IdeaAgent.generateIdeas(context, [], memoryMatches)
       └── returns Idea[] (raw, no pipelineRunId yet)

4. Stamp each idea with pipelineRunId

5. IceScoring
   └── IceScoringAgent.scoreIdeas(ideas, context)
       └── returns Idea[] with IceScore attached to each

6. Persistence
   └── saveIdeas(scoredIdeas)  [ideas table]
   └── savePipelineRun(record) [pipeline_runs table]

7. Return PipelineRunResult { success, pipelineRunId, summary, timings, ideas }
```

Stages 2–4 (IdeaGeneration, IceScoring, Persistence) are fatal — a failure at any of these returns `{ success: false, failedStage, error }`. Memory search failure is non-fatal.

### Stage 2 — `processApprovedIdea(ideaId)` *(planned)*

```
Idea approved by human
  → ScriptAgent.generateScript(idea, context, memoryScripts)
  → QualityReviewAgent.reviewScript(script, idea, context)
      ├── PASS → DeliveryAgent.deliverScript(script, context)
      └── HOLD → saved for human review
```

---

## Database Tables

All tables are created and versioned by `src/database/migrations.ts`. Migrations run once at startup and are recorded in `schema_migrations`.

### `ideas`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `client_id` | TEXT | |
| `pipeline_run_id` | TEXT | |
| `hook_line` | TEXT | |
| `creative_type` | TEXT | |
| `angle` | TEXT | |
| `lead_type` | TEXT | |
| `supporting_proof_points` | TEXT | JSON array |
| `target_avatar` | TEXT | |
| `target_pain` | TEXT | |
| `ice_impact` | INTEGER | nullable until scored |
| `ice_confidence` | INTEGER | nullable until scored |
| `ice_ease` | INTEGER | nullable until scored |
| `ice_recommendation` | TEXT | APPROVE / CONSIDER / REJECT |
| `approval_status` | TEXT | pending / approved / rejected |
| `approved_at` | TEXT | ISO 8601 |
| `approved_by` | TEXT | 'manual' or agent ID |
| `created_at` | TEXT | ISO 8601 |
| `updated_at` | TEXT | ISO 8601 |

### `scripts`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `idea_id` | TEXT UNIQUE | FK to ideas |
| `client_id` | TEXT | |
| `pipeline_run_id` | TEXT | |
| `hook1/2/3` | TEXT | three hook variants |
| `body_problem` | TEXT | |
| `body_story` | TEXT | |
| `body_solution` | TEXT | |
| `body_proof` | TEXT | |
| `body_cta` | TEXT | |
| `production_notes` | TEXT | |
| `status` | TEXT | pending_review / passed / held |
| `delivered_at` | TEXT | |
| `output_path` | TEXT | |
| `created_at` | TEXT | ISO 8601 |

### `quality_reviews`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `script_id` | TEXT UNIQUE | FK to scripts |
| `idea_id` | TEXT | |
| `pipeline_run_id` | TEXT | |
| `overall_decision` | TEXT | PASS / HOLD |
| `overall_score` | INTEGER | |
| `checks` | TEXT | JSON — individual checklist results |
| `created_at` | TEXT | ISO 8601 |

### `pipeline_runs`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID (the pipelineRunId) |
| `client_id` | TEXT | |
| `status` | TEXT | completed / failed |
| `total_ideas` | INTEGER | |
| `approved_candidates` | INTEGER | count of APPROVE recommendations |
| `consider_candidates` | INTEGER | |
| `rejected_candidates` | INTEGER | |
| `idea_generation_ms` | INTEGER | stage timing |
| `ice_scoring_ms` | INTEGER | stage timing |
| `persistence_ms` | INTEGER | stage timing |
| `total_ms` | INTEGER | |
| `failed_stage` | TEXT | null on success |
| `error_message` | TEXT | null on success |
| `started_at` | TEXT | ISO 8601 |
| `completed_at` | TEXT | ISO 8601 |

### `memory_entries`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUID |
| `source_type` | TEXT | idea / script |
| `source_id` | TEXT | FK to ideas or scripts |
| `client_id` | TEXT | search is scoped by this |
| `pipeline_run_id` | TEXT | |
| `text` | TEXT | human-readable summary of the idea or script |
| `embedding_model` | TEXT | e.g. `openai/text-embedding-3-small` |
| `embedding` | TEXT | JSON float array |
| `created_at` | TEXT | ISO 8601 |

Unique index on `(source_type, source_id)` — prevents duplicate embeddings for the same source row.

### `schema_migrations`

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | e.g. `001_create_ideas` |
| `applied_at` | TEXT | ISO 8601 |
