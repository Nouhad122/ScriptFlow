/**
 * Integration test for the ScriptAgent.
 *
 * Run with:   npm run test:scripts
 *
 * This test calls the real AI (OpenRouter) and reads/writes the real database.
 * It verifies the full Script generation flow end-to-end.
 *
 * WHAT THIS VERIFIES:
 *   1.  Pending idea is rejected with a clear error
 *   2.  Rejected idea is rejected with a clear error
 *   3.  Approved idea generates a script successfully
 *   4.  All three hooks are non-empty strings
 *   5.  All body sections are non-empty strings (problem, story, solution, proof, cta)
 *   6.  Script carries the correct ideaId and clientId
 *   7.  Script status starts as 'pending_review'
 *   8.  Script is persisted — getScriptByIdeaId confirms DB write
 *   9.  getScriptByIdeaId returns null for an idea with no script
 *   10. Script fields in DB match the generated script
 *
 * TEST SETUP:
 *   Three ideas are inserted directly into the database with known approval statuses.
 *   This avoids the cost of running the full pipeline (2 AI calls, ~60 seconds).
 *   Only the approved idea triggers an AI call.
 */

import 'dotenv/config';
import { randomUUID } from 'crypto';
import { AIService } from '../services/AIService';
import { ScriptAgent } from '../agents/ScriptAgent';
import { aiConfig } from '../config/ai.config';
import { scriptAgentConfig } from '../config/script.config';
import { env } from '../config/env';
import { runMigrations } from '../database/migrations';
import { saveIdeas } from '../database/ideas.repository';
import { getScriptByIdeaId, saveScript } from '../database/scripts.repository';
import type { ClientContext, Idea } from '../types';

const PASS = '✓';
const FAIL = '✗';

// ---------------------------------------------------------------------------
// Test client context
// ---------------------------------------------------------------------------

const testContext: ClientContext = {
  id: 'script-test-client-001',
  name: 'FreedomCoach',
  niche: 'high-ticket online business coaching',
  avatars: [
    {
      name: 'Stuck 9-to-5er',
      pains: ['No time freedom', 'Underpaid for skills'],
      desires: ['Quit job within 90 days', 'Earn $10K/month online'],
    },
  ],
  brandVoice: {
    tone: 'direct and confident',
    speakingStyle: 'conversational, no jargon',
    doNotUse: ['maybe', 'perhaps', 'sort of'],
    referenceExamples: [],
  },
  proofBank: [
    {
      type: 'result',
      content: 'Client went from $3K to $22K/month in 90 days',
      source: 'Marcus Vane Case Study',
    },
    {
      type: 'testimonial',
      content: 'I replaced my salary in 8 weeks — this system actually works',
      source: 'Sarah M.',
    },
  ],
  offerMechanics: {
    productName: 'Freedom Business Accelerator',
    price: '$3,000',
    guarantee: '30-day money-back guarantee',
    keyBenefits: ['1-on-1 coaching', 'Done-for-you lead generation', 'Private community'],
    cta: 'Book a free strategy call at freedomcoach.com',
  },
  portfolioSummary: 'Helped 200+ entrepreneurs replace their 9-to-5 income within 90 days.',
  referencePackPath: '',
};

// ---------------------------------------------------------------------------
// Test idea factory — fresh UUIDs each run so INSERT OR IGNORE never skips
// ---------------------------------------------------------------------------

const runId = randomUUID();

const approvedIdea: Idea = {
  id: randomUUID(),
  clientId: testContext.id,
  pipelineRunId: runId,
  hookLine: 'You\'re underpaid and you already know it — here\'s what to do about it',
  creativeType: 'talking-head',
  angle: 'proof of income replacement in 90 days',
  leadType: 'problem-led',
  supportingProofPoints: ['Client from $3K to $22K/month in 90 days', 'Salary replaced in 8 weeks'],
  targetAvatar: 'Stuck 9-to-5er',
  targetPain: 'Underpaid for skills with no path to change it',
  iceScore: {
    impact: 9,
    impactReason: 'Directly targets the avatar\'s core pain of being underpaid',
    confidence: 8,
    confidenceReason: 'Proof bank supports the 90-day income replacement claim',
    ease: 8,
    easeReason: 'Talking-head format requires minimal production resources',
    overallReasoning: 'Strong alignment between hook, avatar pain, and available proof.',
    recommendation: 'APPROVE',
  },
  approvalStatus: 'approved',
  approvedAt: new Date(),
  approvedBy: 'test',
  createdAt: new Date(),
};

const pendingIdea: Idea = {
  id: randomUUID(),
  clientId: testContext.id,
  pipelineRunId: runId,
  hookLine: 'Still trading time for money? There\'s a better way',
  creativeType: 'talking-head',
  angle: 'time freedom through online business',
  leadType: 'problem-led',
  supportingProofPoints: ['200+ clients replaced 9-to-5 income'],
  targetAvatar: 'Stuck 9-to-5er',
  targetPain: 'No time freedom',
  iceScore: null,
  approvalStatus: 'pending',
  approvedAt: null,
  approvedBy: null,
  createdAt: new Date(),
};

const rejectedIdea: Idea = {
  id: randomUUID(),
  clientId: testContext.id,
  pipelineRunId: runId,
  hookLine: 'Quit your job tomorrow with zero savings',
  creativeType: 'ugc',
  angle: 'extreme urgency / quit immediately',
  leadType: 'curiosity-led',
  supportingProofPoints: [],
  targetAvatar: 'Stuck 9-to-5er',
  targetPain: 'No time freedom',
  iceScore: null,
  approvalStatus: 'rejected',
  approvedAt: new Date(),
  approvedBy: 'test',
  createdAt: new Date(),
};

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

async function test(label: string, fn: () => void | Promise<void>): Promise<void> {
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
  console.log('\n=== ScriptFlow — Script Agent Integration Test ===\n');
  console.log(`  Model    : ${aiConfig.model}`);
  console.log(`  Temp     : ${scriptAgentConfig.temperature}`);
  console.log(`  Key      : ${env.openrouterApiKey ? `${env.openrouterApiKey.slice(0, 10)}...` : 'NOT SET'}`);
  console.log(`  Note     : One AI call (approved idea only). Pending/rejected tests use no AI.\n`);

  await runMigrations();
  console.log('  [setup] Migrations complete');

  // Insert test ideas directly — bypasses the pipeline to keep the test fast
  await saveIdeas([approvedIdea, pendingIdea, rejectedIdea]);
  console.log(`  [setup] Inserted 3 test ideas (approved, pending, rejected)\n`);

  const ai = new AIService(env.openrouterApiKey, {
    model: aiConfig.model,
    maxTokens: aiConfig.maxTokens,
    temperature: scriptAgentConfig.temperature,
  });
  const agent = new ScriptAgent(ai);

  // ── Test 1: Pending idea is rejected ────────────────────────────────────────

  await test('pending idea is rejected (no AI call)', async () => {
    const result = await agent.generateScript(pendingIdea, testContext, []);
    if (result.success) throw new Error('Expected failure but got success');
    if (!result.error.toLowerCase().includes('approved')) {
      throw new Error(`Error should mention "approved". Got: "${result.error}"`);
    }
  });

  // ── Test 2: Rejected idea is rejected ───────────────────────────────────────

  await test('rejected idea is rejected (no AI call)', async () => {
    const result = await agent.generateScript(rejectedIdea, testContext, []);
    if (result.success) throw new Error('Expected failure but got success');
    if (!result.error.toLowerCase().includes('approved')) {
      throw new Error(`Error should mention "approved". Got: "${result.error}"`);
    }
  });

  // ── Test 3: Approved idea generates a script ────────────────────────────────

  console.log('\n  [running] Calling ScriptAgent.generateScript() for approved idea...\n');
  const scriptResult = await agent.generateScript(approvedIdea, testContext, []);
  console.log();

  await test('approved idea returns success: true', async () => {
    if (!scriptResult.success) {
      throw new Error(
        `ScriptAgent failed: ${(scriptResult as { success: false; error: string }).error}`
      );
    }
  });

  if (!scriptResult.success) {
    console.log('\n  [abort] Script generation failed — skipping remaining tests\n');
    console.log(`  Results: ${passed} passed, ${failed} failed\n`);
    process.exit(1);
  }

  const { data: script } = scriptResult;

  // ── Test 4: Three hooks are non-empty ───────────────────────────────────────

  await test('hook1 is a non-empty string', () => {
    if (!script.hook1 || script.hook1.trim() === '') throw new Error('hook1 is empty');
  });

  await test('hook2 is a non-empty string', () => {
    if (!script.hook2 || script.hook2.trim() === '') throw new Error('hook2 is empty');
  });

  await test('hook3 is a non-empty string', () => {
    if (!script.hook3 || script.hook3.trim() === '') throw new Error('hook3 is empty');
  });

  // ── Test 5: All body sections are non-empty ─────────────────────────────────

  const bodySections: (keyof typeof script.body)[] = ['problem', 'story', 'solution', 'proof', 'cta'];
  for (const section of bodySections) {
    await test(`body.${section} is a non-empty string`, () => {
      const value = script.body[section];
      if (!value || value.trim() === '') throw new Error(`body.${section} is empty`);
    });
  }

  // ── Test 6: Script carries correct identifiers ──────────────────────────────

  await test('script.ideaId matches the input idea id', () => {
    if (script.ideaId !== approvedIdea.id) {
      throw new Error(`script.ideaId="${script.ideaId}" != approvedIdea.id="${approvedIdea.id}"`);
    }
  });

  await test('script.clientId matches the input idea clientId', () => {
    if (script.clientId !== approvedIdea.clientId) {
      throw new Error(`script.clientId="${script.clientId}" != idea.clientId="${approvedIdea.clientId}"`);
    }
  });

  // ── Test 7: Initial status is pending_review ────────────────────────────────

  await test('script.status is "pending_review"', () => {
    if (script.status !== 'pending_review') {
      throw new Error(`Expected "pending_review" but got "${script.status}"`);
    }
  });

  // ── Test 8: Script is persisted ─────────────────────────────────────────────

  await saveScript(script);

  await test('script is retrievable from the database after save', async () => {
    const fromDb = await getScriptByIdeaId(approvedIdea.id);
    if (!fromDb) {
      throw new Error(`getScriptByIdeaId returned null for idea "${approvedIdea.id}"`);
    }
  });

  // ── Test 9: getScriptByIdeaId returns null for idea with no script ──────────

  await test('getScriptByIdeaId returns null for idea with no script', async () => {
    const noScript = await getScriptByIdeaId(pendingIdea.id);
    if (noScript !== null) {
      throw new Error('Expected null but got a script');
    }
  });

  // ── Test 10: DB fields match the generated script ───────────────────────────

  await test('script fields in database match generated script', async () => {
    const fromDb = await getScriptByIdeaId(approvedIdea.id);
    if (!fromDb) throw new Error('Script not found in database');

    if (fromDb.hook1 !== script.hook1) {
      throw new Error(`hook1 mismatch: DB="${fromDb.hook1}" vs generated="${script.hook1}"`);
    }
    if (fromDb.body.problem !== script.body.problem) {
      throw new Error('body.problem mismatch between DB and generated script');
    }
    if (fromDb.body.cta !== script.body.cta) {
      throw new Error('body.cta mismatch between DB and generated script');
    }
    if (fromDb.status !== 'pending_review') {
      throw new Error(`DB status should be "pending_review" but got "${fromDb.status}"`);
    }
  });

  // ── Summary ──────────────────────────────────────────────────────────────────

  console.log(`\n  Script ID   : ${script.id}`);
  console.log(`  Idea ID     : ${script.ideaId}`);
  console.log(`  Status      : ${script.status}`);
  console.log(`  durationMs  : ${scriptResult.durationMs}ms`);
  console.log(`\n  hook1: "${script.hook1}"`);
  console.log(`  hook2: "${script.hook2}"`);
  console.log(`  hook3: "${script.hook3}"`);
  console.log(`\n  body.problem  : "${script.body.problem.slice(0, 80)}..."`);
  console.log(`  body.story    : "${script.body.story.slice(0, 80)}..."`);
  console.log(`  body.solution : "${script.body.solution.slice(0, 80)}..."`);
  console.log(`  body.proof    : "${script.body.proof.slice(0, 80)}..."`);
  console.log(`  body.cta      : "${script.body.cta}"`);
  if (script.productionNotes) {
    console.log(`  productionNotes: "${script.productionNotes}"`);
  }

  console.log(`\n---`);
  console.log(`Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch((error) => {
  console.error('Unexpected test runner error:', error);
  process.exit(1);
});
