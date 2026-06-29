/**
 * Standalone persistence test.
 *
 * Run with:   npm run test:db
 *
 * Tests all four repository functions against a real SQLite database.
 * Runs migrations first so it works on a fresh clone with no existing database.
 *
 * WHAT THIS TESTS:
 *   1. Migrations run without error
 *   2. saveIdeas() persists a batch
 *   3. getPendingIdeas() returns only pending ideas
 *   4. updateIdeaApprovalStatus() approves an idea and returns the updated record
 *   5. updateIdeaApprovalStatus() rejects an idea and returns the updated record
 *   6. getIdeaById() retrieves a specific idea
 *   7. updateIdeaApprovalStatus() returns null for an unknown id
 *   8. saveIdeas() with duplicate ids does not overwrite approval status (INSERT OR IGNORE)
 */

import 'dotenv/config';
import { randomUUID } from 'crypto';
import { runMigrations } from '../database/migrations';
import {
  saveIdeas,
  getPendingIdeas,
  updateIdeaApprovalStatus,
  getIdeaById,
} from '../database/ideas.repository';
import type { Idea } from '../types';

const PASS = '✓';
const FAIL = '✗';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeIdea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: randomUUID(),
    clientId: 'test-client-001',
    pipelineRunId: 'test-run-001',
    hookLine: 'I went from broke to $10k/month in 90 days using this one strategy',
    creativeType: 'story',
    angle: 'transformation story',
    leadType: 'problem-led',
    supportingProofPoints: ['Client A went from $0 to $8k MRR in 12 weeks', 'Client B scaled to $15k in 3 months'],
    targetAvatar: 'Struggling Freelancer',
    targetPain: 'Not knowing how to get consistent clients',
    iceScore: {
      impact: 8,
      impactReason: 'Directly addresses the core pain of income instability',
      confidence: 7,
      confidenceReason: 'Strong proof bank alignment with multiple matching results',
      ease: 9,
      easeReason: 'Talking-head format with no special production requirements',
      overallReasoning: 'High-impact angle with strong proof alignment. Simple to produce.',
      recommendation: 'APPROVE',
    },
    approvalStatus: 'pending',
    createdAt: new Date(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function pass(label: string): void {
  console.log(`  ${PASS} ${label}`);
  passed++;
}

function fail(label: string, reason: string): void {
  console.log(`  ${FAIL} ${label}`);
  console.log(`      → ${reason}`);
  failed++;
}

async function test(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    pass(label);
  } catch (error) {
    fail(label, error instanceof Error ? error.message : String(error));
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function runTests(): Promise<void> {
  console.log('\n=== ScriptFlow — Persistence Test ===\n');

  // Setup
  await runMigrations();
  console.log('  [setup] Migrations complete\n');

  const ideaA = makeIdea({ hookLine: 'Idea A — will be approved' });
  const ideaB = makeIdea({ hookLine: 'Idea B — will be rejected' });
  const ideaC = makeIdea({ hookLine: 'Idea C — stays pending', iceScore: null });

  // 1. Save a batch
  await test('saveIdeas() persists a batch of 3 ideas', async () => {
    await saveIdeas([ideaA, ideaB, ideaC]);
  });

  // 2. Pending queue contains all 3
  await test('getPendingIdeas() returns all 3 pending ideas', async () => {
    const pending = await getPendingIdeas();
    const ids = new Set(pending.map((i) => i.id));
    if (!ids.has(ideaA.id)) throw new Error('ideaA not in pending queue');
    if (!ids.has(ideaB.id)) throw new Error('ideaB not in pending queue');
    if (!ids.has(ideaC.id)) throw new Error('ideaC not in pending queue');
  });

  // 3. Approve ideaA
  await test('updateIdeaApprovalStatus() approves an idea', async () => {
    const updated = await updateIdeaApprovalStatus(ideaA.id, 'approved');
    if (!updated) throw new Error('returned null for existing id');
    if (updated.approvalStatus !== 'approved') throw new Error(`expected 'approved', got '${updated.approvalStatus}'`);
    if (updated.id !== ideaA.id) throw new Error('returned wrong idea');
  });

  // 4. Reject ideaB
  await test('updateIdeaApprovalStatus() rejects an idea', async () => {
    const updated = await updateIdeaApprovalStatus(ideaB.id, 'rejected');
    if (!updated) throw new Error('returned null for existing id');
    if (updated.approvalStatus !== 'rejected') throw new Error(`expected 'rejected', got '${updated.approvalStatus}'`);
  });

  // 5. Pending queue now contains only ideaC
  await test('getPendingIdeas() excludes approved and rejected ideas', async () => {
    const pending = await getPendingIdeas();
    const ids = pending.map((i) => i.id);
    if (ids.includes(ideaA.id)) throw new Error('approved idea still in pending queue');
    if (ids.includes(ideaB.id)) throw new Error('rejected idea still in pending queue');
    if (!ids.includes(ideaC.id)) throw new Error('pending idea missing from queue');
  });

  // 6. getIdeaById returns the right idea with correct fields
  await test('getIdeaById() returns the idea with all fields intact', async () => {
    const idea = await getIdeaById(ideaA.id);
    if (!idea) throw new Error('returned null for existing id');
    if (idea.hookLine !== ideaA.hookLine) throw new Error(`hookLine mismatch: "${idea.hookLine}"`);
    if (!idea.iceScore) throw new Error('iceScore is null after round-trip');
    if (idea.iceScore.impact !== 8) throw new Error(`impact mismatch: ${idea.iceScore.impact}`);
    if (idea.iceScore.recommendation !== 'APPROVE') throw new Error(`recommendation mismatch: ${idea.iceScore.recommendation}`);
    if (!Array.isArray(idea.supportingProofPoints)) throw new Error('supportingProofPoints is not an array after round-trip');
    if (idea.supportingProofPoints.length !== 2) throw new Error(`expected 2 proof points, got ${idea.supportingProofPoints.length}`);
  });

  // 7. getIdeaById returns null for unknown id
  await test('getIdeaById() returns null for unknown id', async () => {
    const idea = await getIdeaById('does-not-exist-' + randomUUID());
    if (idea !== null) throw new Error('expected null, got a record');
  });

  // 8. updateIdeaApprovalStatus returns null for unknown id
  await test('updateIdeaApprovalStatus() returns null for unknown id', async () => {
    const updated = await updateIdeaApprovalStatus('does-not-exist-' + randomUUID(), 'approved');
    if (updated !== null) throw new Error('expected null, got a record');
  });

  // 9. INSERT OR IGNORE does not overwrite approved status
  await test('saveIdeas() does not overwrite existing approval status (INSERT OR IGNORE)', async () => {
    // Re-save ideaA (already approved). If INSERT OR REPLACE was used, this would reset it to pending.
    await saveIdeas([{ ...ideaA, approvalStatus: 'pending' }]);
    const idea = await getIdeaById(ideaA.id);
    if (!idea) throw new Error('idea not found after re-save');
    if (idea.approvalStatus !== 'approved') {
      throw new Error(`INSERT OR IGNORE failed: approval status was overwritten to '${idea.approvalStatus}'`);
    }
  });

  // 10. Unscored idea round-trips correctly (iceScore: null)
  await test('getIdeaById() returns iceScore: null for unscored idea', async () => {
    const idea = await getIdeaById(ideaC.id);
    if (!idea) throw new Error('returned null for existing id');
    if (idea.iceScore !== null) throw new Error('expected null iceScore, got a value');
  });

  // Summary
  console.log(`\n---`);
  console.log(`Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch((error) => {
  console.error('Unexpected test runner error:', error);
  process.exit(1);
});
