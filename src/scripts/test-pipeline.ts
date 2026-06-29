/**
 * Integration test for the PipelineOrchestrator.
 *
 * Run with:   npm run test:pipeline
 *
 * This test calls the real AI (OpenRouter) and writes to the real database.
 * It verifies the full Stage 1 pipeline end-to-end:
 *   IdeaAgent → IceScoringAgent → saveIdeas()
 *
 * WHAT THIS VERIFIES:
 *   1.  Pipeline completes successfully
 *   2.  Ideas are generated (count > 0)
 *   3.  Every idea has an iceScore (not null)
 *   4.  Every idea carries the same pipelineRunId
 *   5.  pipelineRunId is a valid UUID
 *   6.  Summary counts add up to totalIdeas
 *   7.  Summary counts reflect the actual recommendations in the ideas
 *   8.  All timing values are positive numbers
 *   9.  totalMs >= ideaGenerationMs + iceScoringMs + persistenceMs
 *   10. Ideas are persisted — getIdeaById confirms DB write
 */

import 'dotenv/config';
import { AIService } from '../services/AIService';
import { IdeaAgent } from '../agents/IdeaAgent';
import { IceScoringAgent } from '../agents/IceScoringAgent';
import { PipelineOrchestrator } from '../orchestrator/PipelineOrchestrator';
import { aiConfig } from '../config/ai.config';
import { ideaAgentConfig } from '../config/idea.config';
import { iceAgentConfig } from '../config/ice.config';
import { env } from '../config/env';
import { runMigrations } from '../database/migrations';
import { getIdeaById } from '../database/ideas.repository';
import type { ClientContext } from '../types';

const PASS = '✓';
const FAIL = '✗';

// ---------------------------------------------------------------------------
// Minimal ClientContext for testing
// ---------------------------------------------------------------------------

const testContext: ClientContext = {
  id: 'pipeline-test-client-001',
  name: 'FreedomCoach',
  niche: 'high-ticket online business coaching',
  avatars: [
    {
      name: 'Stuck 9-to-5er',
      pains: ['No time freedom', 'Underpaid for their skills'],
      desires: ['Quit their job within 90 days', 'Earn $10K/month online'],
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
  console.log('\n=== ScriptFlow — Pipeline Integration Test ===\n');
  console.log(`  Model    : ${aiConfig.model}`);
  console.log(`  Key      : ${env.openrouterApiKey ? `${env.openrouterApiKey.slice(0, 10)}...` : 'NOT SET'}`);
  console.log(`  Note     : This test calls the real AI and writes to the real database.\n`);

  await runMigrations();
  console.log('  [setup] Migrations complete\n');

  // Build the orchestrator the same way the controller does
  const ideaAI = new AIService(env.openrouterApiKey, {
    model: aiConfig.model,
    maxTokens: aiConfig.maxTokens,
    temperature: ideaAgentConfig.temperature,
  });
  const iceAI = new AIService(env.openrouterApiKey, {
    model: aiConfig.model,
    maxTokens: aiConfig.maxTokens,
    temperature: iceAgentConfig.temperature,
  });
  const orchestrator = new PipelineOrchestrator(new IdeaAgent(ideaAI), new IceScoringAgent(iceAI));

  console.log('  [running] Calling orchestrator.generateAndScoreIdeas()...\n');
  const result = await orchestrator.generateAndScoreIdeas(testContext);
  console.log();

  // 1. Pipeline completed successfully
  await test('pipeline returns success: true', async () => {
    if (!result.success) {
      const r = result as { success: false; failedStage: string; error: string };
      throw new Error(`Pipeline failed at stage "${r.failedStage}": ${r.error}`);
    }
  });

  if (!result.success) {
    console.log('\n  [abort] Pipeline failed — skipping remaining tests\n');
    console.log(`  Results: ${passed} passed, ${failed} failed\n`);
    process.exit(1);
  }

  const { pipelineRunId, summary, timings, ideas } = result;

  // 2. Ideas were generated
  await test('ideas array is non-empty', () => {
    if (ideas.length === 0) throw new Error('ideas array is empty');
  });

  // 3. Every idea has an iceScore
  await test('every idea has iceScore populated (not null)', () => {
    const unscored = ideas.filter((i) => i.iceScore === null);
    if (unscored.length > 0) {
      throw new Error(`${unscored.length} idea(s) have null iceScore`);
    }
  });

  // 4. pipelineRunId is identical on every idea
  await test('all ideas carry the same pipelineRunId', () => {
    const mismatched = ideas.filter((i) => i.pipelineRunId !== pipelineRunId);
    if (mismatched.length > 0) {
      throw new Error(`${mismatched.length} idea(s) have a different pipelineRunId`);
    }
  });

  // 5. pipelineRunId is a valid UUID
  await test('pipelineRunId is a valid UUID', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(pipelineRunId)) {
      throw new Error(`"${pipelineRunId}" is not a valid v4 UUID`);
    }
  });

  // 6. Summary total equals ideas.length
  await test('summary.totalIdeas equals ideas.length', () => {
    if (summary.totalIdeas !== ideas.length) {
      throw new Error(`summary.totalIdeas=${summary.totalIdeas} but ideas.length=${ideas.length}`);
    }
  });

  // 7. Summary counts are internally consistent
  await test('summary candidate counts add up to totalIdeas', () => {
    const sum = summary.approvedCandidates + summary.considerCandidates + summary.rejectedCandidates;
    if (sum !== summary.totalIdeas) {
      throw new Error(
        `${summary.approvedCandidates} + ${summary.considerCandidates} + ${summary.rejectedCandidates} = ${sum}, expected ${summary.totalIdeas}`
      );
    }
  });

  // 8. Summary counts match actual recommendations in ideas
  await test('summary counts match actual iceScore.recommendation values', () => {
    const actual = {
      approve: ideas.filter((i) => i.iceScore?.recommendation === 'APPROVE').length,
      consider: ideas.filter((i) => i.iceScore?.recommendation === 'CONSIDER').length,
      reject: ideas.filter((i) => i.iceScore?.recommendation === 'REJECT').length,
    };
    if (actual.approve !== summary.approvedCandidates) {
      throw new Error(`approvedCandidates: summary=${summary.approvedCandidates}, actual=${actual.approve}`);
    }
    if (actual.consider !== summary.considerCandidates) {
      throw new Error(`considerCandidates: summary=${summary.considerCandidates}, actual=${actual.consider}`);
    }
    if (actual.reject !== summary.rejectedCandidates) {
      throw new Error(`rejectedCandidates: summary=${summary.rejectedCandidates}, actual=${actual.reject}`);
    }
  });

  // 9. All timing values are positive
  await test('all timing values are positive numbers', () => {
    const entries = Object.entries(timings) as [string, number][];
    for (const [key, ms] of entries) {
      if (typeof ms !== 'number' || ms <= 0) {
        throw new Error(`timings.${key} is not a positive number: ${ms}`);
      }
    }
  });

  // 10. totalMs >= sum of stage timings (orchestrator overhead is always positive)
  await test('totalMs >= ideaGenerationMs + iceScoringMs + persistenceMs', () => {
    const stageSum = timings.ideaGenerationMs + timings.iceScoringMs + timings.persistenceMs;
    if (timings.totalMs < stageSum) {
      throw new Error(`totalMs=${timings.totalMs} is less than stageSum=${stageSum}`);
    }
  });

  // 11. Ideas were actually persisted — spot-check the first idea via DB read
  await test('first idea is retrievable from the database after the run', async () => {
    const firstIdea = ideas[0];
    const fromDb = await getIdeaById(firstIdea.id);
    if (!fromDb) throw new Error(`idea ${firstIdea.id} not found in database after pipeline`);
    if (fromDb.pipelineRunId !== pipelineRunId) {
      throw new Error(`DB pipelineRunId="${fromDb.pipelineRunId}" does not match run "${pipelineRunId}"`);
    }
    if (!fromDb.iceScore) throw new Error('idea in DB has null iceScore after pipeline');
  });

  // Summary
  console.log(`\n  pipelineRunId : ${pipelineRunId}`);
  console.log(`  Ideas         : ${summary.totalIdeas} (APPROVE: ${summary.approvedCandidates}, CONSIDER: ${summary.considerCandidates}, REJECT: ${summary.rejectedCandidates})`);
  console.log(`  Timings       : idea=${timings.ideaGenerationMs}ms  ice=${timings.iceScoringMs}ms  persist=${timings.persistenceMs}ms  total=${timings.totalMs}ms`);
  console.log(`\n---`);
  console.log(`Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) process.exit(1);
}

runTests().catch((error) => {
  console.error('Unexpected test runner error:', error);
  process.exit(1);
});
