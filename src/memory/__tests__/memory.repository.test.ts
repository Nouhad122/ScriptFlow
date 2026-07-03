import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@libsql/client';
import { randomUUID } from 'crypto';
import { MemoryRepository } from '../MemoryRepository';
import type { MemoryEntry } from '../types';

function makeEntry(overrides: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: randomUUID(),
    sourceType: 'idea',
    sourceId: randomUUID(),
    clientId: 'client-alpha',
    pipelineRunId: 'run-1',
    text: 'Hook: Stop trading time for money\nAngle: freedom through systems',
    embeddingModel: 'voyage-3-lite',
    embedding: [0.1, 0.2, 0.3],
    createdAt: new Date('2025-01-15T10:00:00.000Z'),
    ...overrides,
  };
}

describe('MemoryRepository', () => {
  let repo: MemoryRepository;

  beforeEach(async () => {
    // Each test gets a fresh in-memory database to guarantee isolation.
    const db = createClient({ url: ':memory:' });
    repo = new MemoryRepository(db);
    await repo.ensureSchema();
  });

  // ── saveEntry / getAllEntries ───────────────────────────────────────────────

  it('saves an entry and retrieves it', async () => {
    const entry = makeEntry();
    await repo.saveEntry(entry);

    const all = await repo.getAllEntries();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(entry.id);
  });

  it('round-trips the embedding vector without precision loss', async () => {
    const entry = makeEntry({ embedding: [0.123456789, -0.987654321, 0.0] });
    await repo.saveEntry(entry);

    const [fetched] = await repo.getAllEntries();
    expect(fetched.embedding[0]).toBeCloseTo(0.123456789, 8);
    expect(fetched.embedding[1]).toBeCloseTo(-0.987654321, 8);
    expect(fetched.embedding[2]).toBe(0);
  });

  it('round-trips sourceType correctly for idea', async () => {
    const entry = makeEntry({ sourceType: 'idea' });
    await repo.saveEntry(entry);
    const [fetched] = await repo.getAllEntries();
    expect(fetched.sourceType).toBe('idea');
  });

  it('round-trips sourceType correctly for script', async () => {
    const entry = makeEntry({ sourceType: 'script' });
    await repo.saveEntry(entry);
    const [fetched] = await repo.getAllEntries();
    expect(fetched.sourceType).toBe('script');
  });

  it('round-trips all string fields', async () => {
    const entry = makeEntry({
      text: 'Hook: Fire your boss\nAngle: time freedom',
      embeddingModel: 'voyage-3',
      sourceId: 'source-xyz',
      clientId: 'client-beta',
      pipelineRunId: 'run-99',
    });
    await repo.saveEntry(entry);
    const [fetched] = await repo.getAllEntries();
    expect(fetched.text).toBe(entry.text);
    expect(fetched.embeddingModel).toBe('voyage-3');
    expect(fetched.sourceId).toBe('source-xyz');
    expect(fetched.clientId).toBe('client-beta');
    expect(fetched.pipelineRunId).toBe('run-99');
  });

  it('round-trips createdAt as a Date', async () => {
    const entry = makeEntry({ createdAt: new Date('2025-06-30T12:00:00.000Z') });
    await repo.saveEntry(entry);
    const [fetched] = await repo.getAllEntries();
    expect(fetched.createdAt).toBeInstanceOf(Date);
    expect(fetched.createdAt.toISOString()).toBe('2025-06-30T12:00:00.000Z');
  });

  it('returns empty array when no entries have been saved', async () => {
    const all = await repo.getAllEntries();
    expect(all).toHaveLength(0);
  });

  it('returns multiple entries saved sequentially', async () => {
    await repo.saveEntry(makeEntry());
    await repo.saveEntry(makeEntry());
    await repo.saveEntry(makeEntry());
    const all = await repo.getAllEntries();
    expect(all).toHaveLength(3);
  });

  it('saves embeddings of arbitrary length', async () => {
    const longEmbedding = Array.from({ length: 512 }, (_, i) => i * 0.001);
    const entry = makeEntry({ embedding: longEmbedding });
    await repo.saveEntry(entry);
    const [fetched] = await repo.getAllEntries();
    expect(fetched.embedding).toHaveLength(512);
  });

  // ── getEntriesByClient ─────────────────────────────────────────────────────

  it('returns only entries matching the requested clientId', async () => {
    await repo.saveEntry(makeEntry({ clientId: 'client-alpha' }));
    await repo.saveEntry(makeEntry({ clientId: 'client-beta' }));
    await repo.saveEntry(makeEntry({ clientId: 'client-alpha' }));

    const alpha = await repo.getEntriesByClient('client-alpha');
    expect(alpha).toHaveLength(2);
    alpha.forEach((e) => expect(e.clientId).toBe('client-alpha'));
  });

  it('returns empty array when the client has no entries', async () => {
    await repo.saveEntry(makeEntry({ clientId: 'client-alpha' }));
    const entries = await repo.getEntriesByClient('client-unknown');
    expect(entries).toHaveLength(0);
  });

  it('returns empty array when the store is empty', async () => {
    const entries = await repo.getEntriesByClient('client-alpha');
    expect(entries).toHaveLength(0);
  });
});
