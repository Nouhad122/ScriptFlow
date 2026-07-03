/**
 * MemoryRepository — persistence layer for the memory module.
 *
 * DESIGN: Constructor injection instead of the global getDb() singleton.
 *   Existing repositories call getDb() directly. MemoryRepository instead
 *   accepts a Client via its constructor. This makes it testable: tests can
 *   pass a createClient({ url: ':memory:' }) without touching the app's database.
 *   The factory function createMemoryRepository() bridges to the app's singleton
 *   for production use. Nothing outside the memory module calls it yet.
 *
 * STORAGE FORMAT:
 *   Embeddings are stored as JSON arrays (e.g., "[0.123, -0.456, 0.789, ...]").
 *   This is intentionally unoptimised — SQLite stores them as text, which is
 *   ~4× larger than sqlite-vec's native BLOB format. The schema comment in
 *   SimilaritySearch.ts describes the upgrade path.
 *
 * ensureSchema():
 *   Not called automatically to avoid coupling the constructor to async work.
 *   Tests call it explicitly. The migration runner (migration 006) creates the
 *   table in production before any repository method is invoked.
 */

import type { Client } from '@libsql/client';
import { getDb } from '../database/connection';
import type { MemoryEntry, MemorySourceType } from './types';

const TABLE_DDL = `
  CREATE TABLE IF NOT EXISTS memory_entries (
    id               TEXT    PRIMARY KEY,
    source_type      TEXT    NOT NULL CHECK (source_type IN ('idea', 'script')),
    source_id        TEXT    NOT NULL,
    client_id        TEXT    NOT NULL,
    pipeline_run_id  TEXT    NOT NULL,
    text             TEXT    NOT NULL,
    embedding_model  TEXT    NOT NULL,
    embedding        TEXT    NOT NULL,
    created_at       TEXT    NOT NULL
  )
`;

function rowToEntry(row: Record<string, unknown>): MemoryEntry {
  return {
    id: row['id'] as string,
    sourceType: row['source_type'] as MemorySourceType,
    sourceId: row['source_id'] as string,
    clientId: row['client_id'] as string,
    pipelineRunId: row['pipeline_run_id'] as string,
    text: row['text'] as string,
    embeddingModel: row['embedding_model'] as string,
    embedding: JSON.parse(row['embedding'] as string) as number[],
    createdAt: new Date(row['created_at'] as string),
  };
}

export class MemoryRepository {
  constructor(private readonly db: Client) {}

  /** Creates the memory_entries table if it does not exist. Used by tests. */
  async ensureSchema(): Promise<void> {
    await this.db.execute(TABLE_DDL);
  }

  async saveEntry(entry: MemoryEntry): Promise<void> {
    await this.db.execute({
      sql: `INSERT OR IGNORE INTO memory_entries
              (id, source_type, source_id, client_id, pipeline_run_id,
               text, embedding_model, embedding, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        entry.id,
        entry.sourceType,
        entry.sourceId,
        entry.clientId,
        entry.pipelineRunId,
        entry.text,
        entry.embeddingModel,
        JSON.stringify(entry.embedding),
        entry.createdAt.toISOString(),
      ],
    });
  }

  async getAllEntries(): Promise<MemoryEntry[]> {
    const result = await this.db.execute(
      'SELECT * FROM memory_entries ORDER BY created_at DESC',
    );
    return result.rows.map(rowToEntry);
  }

  async getEntriesByClient(clientId: string): Promise<MemoryEntry[]> {
    const result = await this.db.execute({
      sql: 'SELECT * FROM memory_entries WHERE client_id = ? ORDER BY created_at DESC',
      args: [clientId],
    });
    return result.rows.map(rowToEntry);
  }
}

/** Creates a MemoryRepository backed by the application's shared database connection. */
export function createMemoryRepository(): MemoryRepository {
  return new MemoryRepository(getDb());
}
