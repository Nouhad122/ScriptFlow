/**
 * Integration test for the QualityReviewAgent.
 *
 * Run with:   npm run test:quality
 *
 * This test makes TWO real AI calls:
 *   1. ScriptAgent   — generates a script for the approved idea
 *   2. QualityReviewAgent — reviews the generated script
 *
 * Using a fresh script each run ensures the review is meaningful and not cached.
 * Ideas and scripts are inserted/generated with fresh UUIDs so tests are independent.
 *
 * WHAT THIS VERIFIES:
 *   1.  Script is generated successfully for the approved test idea
 *   2.  QualityReview returns success: true
 *   3.  All 10 checks are present and correctly shaped
 *   4.  Scored checks have integer scores 1–10
 *   5.  Boolean checks have pass + reason
 *   6.  overallDecision is 'PASS' or 'HOLD'
 *   7.  overallScore is an integer 0–100
 *   8.  overallDecision is consistent with checks (PASS only if all checks pass)
 *   9.  QualityReview is persisted — getReviewByScriptId confirms DB write
 *   10. Script status in DB is updated to 'passed' or 'held' after review
 *   11. Script status matches overallDecision
 */

import 'dotenv/config';
import { randomUUID } from 'crypto';
import { AIService } from '../services/AIService';
import { ScriptAgent } from '../agents/ScriptAgent';
import { QualityReviewAgent } from '../agents/QualityReviewAgent';
import { aiConfig } from '../config/ai.config';
import { scriptAgentConfig } from '../config/script.config';
import { qualityAgentConfig } from '../config/quality.config';
import { env } from '../config/env';
import { runMigrations } from '../database/migrations';
import { saveIdeas } from '../database/ideas.repository';
import { saveScript, getScriptById } from '../database/scripts.repository';
import { saveReview, getReviewByScriptId } from '../database/quality.repository';
import { updateScriptStatus } from '../database/scripts.repository';
import type { ClientContext, Idea } from '../types';

const PASS = '✓';
const FAIL = '✗';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const testContext: ClientContext = {
  id: 'quality-test-client-001',
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

const runId = randomUUID();

const approvedIdea: Idea = {
  id: randomUUID(),
  clientId: testContext.id,
  pipelineRunId: runId,
  hookLine: "You're worth way more than your paycheck — here's exactly what to do about it",
  creativeType: 'talking-head',
  angle: 'proof of income replacement in 90 days',
  leadType: 'problem-led',
  supportingProofPoints: ['$3K to $22K/month in 90 days', 'Salary replaced in 8 weeks'],
  targetAvatar: 'Stuck 9-to-5er',
  targetPain: 'Underpaid and stuck with no path to change it',
  iceScore: {
    impact: 9,
    impactReason: 'Directly targets underpaid avatar pain',
    confidence: 8,
    confidenceReason: 'Proof bank supports the income replacement claim',
    ease: 8,
    easeReason: 'Talking-head format, minimal production',
    overallReasoning: 'Strong alignment between hook, pain, and proof.',
    recommendation: 'APPROVE',
  },
  approvalStatus: 'approved',
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
  console.log('\n=== ScriptFlow — Quality Review Agent Integration Test ===\n');
  console.log(`  Model (script)  : ${aiConfig.model} @ temp ${scriptAgentConfig.temperature}`);
  console.log(`  Model (quality) : ${aiConfig.model} @ temp ${qualityAgentConfig.temperature}`);
  console.log(`  Note            : Two AI calls — script generation + quality review.\n`);

  await runMigrations();
  console.log('  [setup] Migrations complete');

  await saveIdeas([approvedIdea]);
  console.log('  [setup] Approved test idea inserted\n');

  // ── Step 1: Generate a script ─────────────────────────────────────────────

  const scriptAI = new AIService(env.openrouterApiKey, {
    model: aiConfig.model,
    maxTokens: aiConfig.maxTokens,
    temperature: scriptAgentConfig.temperature,
  });
  const scriptAgent = new ScriptAgent(scriptAI);

  console.log('  [running] Generating script...\n');
  const scriptResult = await scriptAgent.generateScript(approvedIdea, testContext, []);
  console.log();

  await test('script generated successfully (Step 1 prerequisite)', async () => {
    if (!scriptResult.success) {
      throw new Error(
        `ScriptAgent failed: ${(scriptResult as { success: false; error: string }).error}`
      );
    }
  });

  if (!scriptResult.success) {
    console.log('\n  [abort] Script generation failed\n');
    process.exit(1);
  }

  const script = scriptResult.data;
  await saveScript(script);
  console.log(`  [setup] Script saved: ${script.id}\n`);

  // ── Step 2: Run quality review ────────────────────────────────────────────

  const qualityAI = new AIService(env.openrouterApiKey, {
    model: aiConfig.model,
    maxTokens: aiConfig.maxTokens,
    temperature: qualityAgentConfig.temperature,
  });
  const qualityAgent = new QualityReviewAgent(qualityAI);

  console.log('  [running] Running QualityReviewAgent...\n');
  const reviewResult = await qualityAgent.reviewScript(script, approvedIdea, testContext);
  console.log();

  // Test 2: Agent returned success
  await test('quality review returns success: true', async () => {
    if (!reviewResult.success) {
      throw new Error(
        `QualityReviewAgent failed: ${(reviewResult as { success: false; error: string }).error}`
      );
    }
  });

  if (!reviewResult.success) {
    console.log('\n  [abort] Quality review failed\n');
    process.exit(1);
  }

  const { data: review } = reviewResult;

  // Test 3: All 10 checks present
  await test('all 10 checks are present in the response', () => {
    const required = [
      'hookStrength',
      'problemClarity',
      'storyFlow',
      'solutionAlignment',
      'proofAccuracy',
      'ctaAlignment',
      'brandVoice',
      'fabrication',
      'length',
      'structure',
    ];
    for (const key of required) {
      if (!(key in review.checks)) throw new Error(`Missing check: "${key}"`);
    }
  });

  // Test 4: Scored checks have valid scores
  await test('scored checks have integer scores 1–10', () => {
    const scored = [
      'hookStrength',
      'problemClarity',
      'storyFlow',
      'solutionAlignment',
      'proofAccuracy',
      'ctaAlignment',
      'brandVoice',
    ] as const;
    for (const key of scored) {
      const check = review.checks[key];
      if (!Number.isInteger(check.score) || check.score < 1 || check.score > 10) {
        throw new Error(`${key}.score=${check.score} is not an integer 1–10`);
      }
    }
  });

  // Test 5: Binary checks have pass + reason
  await test('binary checks have pass boolean and non-empty reason', () => {
    const binary = ['fabrication', 'length', 'structure'] as const;
    for (const key of binary) {
      const check = review.checks[key];
      if (typeof check.pass !== 'boolean') throw new Error(`${key}.pass is not boolean`);
      if (!check.reason || check.reason.trim() === '') throw new Error(`${key}.reason is empty`);
    }
  });

  // Test 6: overallDecision is valid
  await test('overallDecision is "PASS" or "HOLD"', () => {
    if (review.overallDecision !== 'PASS' && review.overallDecision !== 'HOLD') {
      throw new Error(`Invalid overallDecision: "${review.overallDecision}"`);
    }
  });

  // Test 7: overallScore is 0–100
  await test('overallScore is an integer 0–100', () => {
    if (
      !Number.isInteger(review.overallScore) ||
      review.overallScore < 0 ||
      review.overallScore > 100
    ) {
      throw new Error(`overallScore=${review.overallScore} is not an integer 0–100`);
    }
  });

  // Test 8: overallDecision is consistent with check pass values
  await test('overallDecision is consistent with checks (PASS only if all pass)', () => {
    const allChecksPass = Object.values(review.checks).every((c) => c.pass);
    if (review.overallDecision === 'PASS' && !allChecksPass) {
      const failing = Object.entries(review.checks)
        .filter(([, c]) => !c.pass)
        .map(([k]) => k)
        .join(', ');
      throw new Error(`overallDecision=PASS but these checks failed: ${failing}`);
    }
    if (review.overallDecision === 'HOLD' && allChecksPass) {
      throw new Error('overallDecision=HOLD but all checks passed — inconsistent');
    }
  });

  // Test 9: QualityReview persisted
  await saveReview(review);

  const newStatus = review.overallDecision === 'PASS' ? 'passed' : 'held';
  await updateScriptStatus(script.id, newStatus);

  await test('review is retrievable from the database after save', async () => {
    const fromDb = await getReviewByScriptId(script.id);
    if (!fromDb) throw new Error(`getReviewByScriptId returned null for script "${script.id}"`);
    if (fromDb.overallDecision !== review.overallDecision) {
      throw new Error(
        `DB decision "${fromDb.overallDecision}" != generated "${review.overallDecision}"`
      );
    }
  });

  // Test 10: Script status updated in DB
  await test('script status updated in DB after review', async () => {
    const fromDb = await getScriptById(script.id);
    if (!fromDb) throw new Error('Script not found in DB');
    const expectedStatus = review.overallDecision === 'PASS' ? 'passed' : 'held';
    if (fromDb.status !== expectedStatus) {
      throw new Error(`DB script status="${fromDb.status}", expected="${expectedStatus}"`);
    }
  });

  // Test 11: Script status matches overallDecision
  await test('script status matches overallDecision', () => {
    const expectedStatus = review.overallDecision === 'PASS' ? 'passed' : 'held';
    const actualStatus = newStatus;
    if (actualStatus !== expectedStatus) {
      throw new Error(
        `Status="${actualStatus}" should be "${expectedStatus}" for decision "${review.overallDecision}"`
      );
    }
  });

  // ── Summary ──────────────────────────────────────────────────────────────────

  console.log(`\n  Review ID       : ${review.id}`);
  console.log(`  Script ID       : ${review.scriptId}`);
  console.log(`  overallDecision : ${review.overallDecision}`);
  console.log(`  overallScore    : ${review.overallScore}/100`);
  console.log(`  Script status   : ${newStatus}`);
  console.log(`  durationMs      : ${reviewResult.durationMs}ms\n`);

  console.log('  Check results:');
  const scored = [
    'hookStrength',
    'problemClarity',
    'storyFlow',
    'solutionAlignment',
    'proofAccuracy',
    'ctaAlignment',
    'brandVoice',
  ] as const;
  for (const key of scored) {
    const c = review.checks[key];
    console.log(`    ${c.pass ? PASS : FAIL} ${key.padEnd(20)} ${c.score}/10`);
  }
  const binary = ['fabrication', 'length', 'structure'] as const;
  for (const key of binary) {
    const c = review.checks[key];
    console.log(`    ${c.pass ? PASS : FAIL} ${key.padEnd(20)} (${c.pass ? 'pass' : 'fail'})`);
  }

  console.log(`\n---`);
  console.log(`Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch((error) => {
  console.error('Unexpected test runner error:', error);
  process.exit(1);
});
