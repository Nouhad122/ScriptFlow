/**
 * Standalone AI connection test.
 *
 * Run with:   npm run test:ai
 *
 * Tests both AIService methods independently of the HTTP server.
 * Use this to verify your Gemini API key is working before running the full pipeline.
 */

import 'dotenv/config';
import { AIService } from '../services/AIService';
import { env } from '../config/env';
import { aiConfig } from '../config/ai.config';

const PASS = '✓';
const FAIL = '✗';

async function runTests(): Promise<void> {
  console.log('\n=== ScriptFlow — Gemini Connection Test ===\n');
  console.log(`Model : ${aiConfig.model}`);
  console.log(`Key   : ${env.geminiApiKey ? `${env.geminiApiKey.slice(0, 10)}...` : 'NOT SET'}\n`);

  const service = new AIService(env.geminiApiKey);
  let passed = 0;
  let failed = 0;

  // Test 1: generateText
  process.stdout.write('Test 1 — generateText ..................... ');
  try {
    const start = Date.now();
    const result = await service.generateText('Reply with the single word: HEALTHY');
    const ms = Date.now() - start;
    console.log(`${PASS} "${result.trim()}" (${ms}ms)`);
    passed++;
  } catch (error) {
    console.log(`${FAIL} ${error instanceof Error ? error.message : error}`);
    failed++;
  }

  // Test 2: generateStructured
  process.stdout.write('Test 2 — generateStructured<T> ........... ');
  try {
    interface TestShape { status: string; value: number }
    const start = Date.now();
    const result = await service.generateStructured<TestShape>(
      'Return a JSON object with two fields: "status" set to "ok" and "value" set to 42.'
    );
    const ms = Date.now() - start;
    const shapeOk = result.status === 'ok' && result.value === 42;
    if (shapeOk) {
      console.log(`${PASS} { status: "${result.status}", value: ${result.value} } (${ms}ms)`);
      passed++;
    } else {
      console.log(`${FAIL} Unexpected shape: ${JSON.stringify(result)}`);
      failed++;
    }
  } catch (error) {
    console.log(`${FAIL} ${error instanceof Error ? error.message : error}`);
    failed++;
  }

  // Summary
  console.log(`\n---`);
  console.log(`Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('Unexpected test runner error:', error);
  process.exit(1);
});
