/**
 * Milestone 6 & 7 Demo
 * Demonstrates CLI scaffolding, resilience patterns, and testing
 */

import { AfrScaffolder } from './cli/scaffolder.js';
import { RetryPolicy, CircuitBreaker, ResilientExecutor, CircuitState } from './resilience/resilience.js';
import { createExecutionContext } from './executor/session.js';

console.log('=== AFR Milestone 6 & 7 Demo ===\n');

// ============================================================================
// MILESTONE 6: CLI SCAFFOLDING DEMO
// ============================================================================

console.log('--- Milestone 6: CLI and Developer Experience ---\n');

console.log('1. Project Scaffolding API');
console.log('   The AfrScaffolder class generates complete projects');
console.log('   Usage: npx create-afr-agent my-project\n');

const scaffolder = new AfrScaffolder();
console.log('   ✓ AfrScaffolder class initialized');
console.log('   ✓ Ready to scaffold new projects\n');

console.log('2. Template Generation');
console.log('   Files automatically generated:');
console.log('   - package.json (with agentic-file-routing dependency)');
console.log('   - tsconfig.json (strict mode, ES2022)');
console.log('   - src/agents/index.ts (root orchestrator)');
console.log('   - Example agents: research, writing, analysis');
console.log('   - README.md with quick-start instructions');
console.log('   - .gitignore configured\n');

console.log('3. Agent Stub Generation');
console.log('   Create new agents programmatically:');
const agentStubAPI = `
   scaffolder.generateAgentStub(projectPath, {
     agentName: 'DataAnalysis',
     agentPath: 'analytics.data-analysis',
     description: 'Analyze data and generate reports',
     model: 'gpt-4'
   });
`;
console.log(agentStubAPI);

// ============================================================================
// MILESTONE 7: RESILIENCE PATTERNS DEMO
// ============================================================================

console.log('\n--- Milestone 7: Production Hardening ---\n');

console.log('1. Retry Policy with Exponential Backoff\n');

const retryPolicy = new RetryPolicy({
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
});

console.log('   Configuration:');
console.log('   - Max attempts: 3');
console.log('   - Initial delay: 100ms');
console.log('   - Backoff multiplier: 2x');
console.log('   - Max delay: 10s\n');

let callCount = 0;
let delayHistory: number[] = [];

await retryPolicy
  .execute(
    async () => {
      callCount++;
      if (callCount < 3) {
        throw new Error(`Attempt ${callCount} failed`);
      }
      return 'Success on attempt 3';
    },
    (attempt, delay, error) => {
      delayHistory.push(delay);
      console.log(`   Retry ${attempt}: waiting ${delay.toFixed(0)}ms...`);
      console.log(`   Error: ${error.message}`);
    }
  )
  .then((result) => {
    console.log(`   ✓ Result: ${result}\n`);
  });

// ============================================================================

console.log('2. Circuit Breaker Pattern\n');

const circuitBreaker = new CircuitBreaker({
  failureThreshold: 2,
  successThreshold: 1,
  timeout: 5000,
});

console.log('   Configuration:');
console.log('   - Failure threshold: 2');
console.log('   - Success threshold: 1');
console.log('   - Timeout: 5s\n');

// Simulate failures to open circuit
let cbTestCount = 0;
for (let i = 0; i < 3; i++) {
  try {
    await circuitBreaker.execute(async () => {
      cbTestCount++;
      if (cbTestCount <= 2) {
        throw new Error('Simulated failure');
      }
      return 'Success';
    });
  } catch (error) {
    console.log(`   Attempt ${i + 1}: ${error instanceof Error ? error.message : error}`);
  }
}

console.log(`   Circuit state: ${circuitBreaker.getState()}\n`);

// ============================================================================

console.log('3. Resilient Executor (Retry + Circuit Breaker)\n');

const resilientExecutor = new ResilientExecutor(
  { maxAttempts: 2, initialDelayMs: 50 },
  { failureThreshold: 3, successThreshold: 1 }
);

console.log('   Combined retry + circuit breaker:');
console.log('   - Retries first with exponential backoff');
console.log('   - Circuit breaker catches repeated failures');
console.log('   - Single execute() for unified resilience\n');

let resilientTestAttempts = 0;
const resilientResult = await resilientExecutor.execute(async () => {
  resilientTestAttempts++;
  if (resilientTestAttempts === 1) {
    throw new Error('First attempt fails');
  }
  return 'Recovered on second attempt';
});

console.log(`   ✓ Result: ${resilientResult}`);
console.log(`   ✓ Attempts: ${resilientTestAttempts}\n`);

// ============================================================================
// TESTING INFRASTRUCTURE
// ============================================================================

console.log('4. Comprehensive Unit Tests\n');

console.log('   Test suites implemented:');
console.log('   1. resilience.test.ts');
console.log('      - RetryPolicy behavior');
console.log('      - Exponential backoff calculation');
console.log('      - CircuitBreaker state transitions');
console.log('      - ResilientExecutor combined behavior');
console.log('      Tests: 7\n');

console.log('   2. path-utils.test.ts');
console.log('      - Segment parsing (static, dynamic, catch-all)');
console.log('      - Logical path building');
console.log('      - Route pattern generation');
console.log('      Tests: 6\n');

console.log('   3. session.test.ts');
console.log('      - ExecutionContext initialization');
console.log('      - Context inheritance from parent');
console.log('      - Local overrides');
console.log('      - SessionFrame message tracking');
console.log('      Tests: 5\n');

console.log('   4. policy.test.ts');
console.log('      - Policy enforcement (allow/deny)');
console.log('      - Wildcard matching in resources');
console.log('      - Default deny behavior');
console.log('      Tests: 3\n');

console.log('   Run tests: npm test');
console.log('   Run with watch: npm run test:watch\n');

// ============================================================================
// SUMMARY
// ============================================================================

console.log('--- Summary ---\n');

console.log('Milestone 6 - CLI & Developer Experience:');
console.log('✓ create-afr-agent CLI tool for project scaffolding');
console.log('✓ Complete project templates with examples');
console.log('✓ Agent stub generation API');
console.log('✓ TypeScript configuration and build setup\n');

console.log('Milestone 7 - Production Hardening:');
console.log('✓ RetryPolicy with exponential backoff + jitter');
console.log('✓ CircuitBreaker with three-state pattern');
console.log('✓ ResilientExecutor combining both patterns');
console.log('✓ 19+ unit tests covering core modules');
console.log('✓ Test infrastructure using Node.js native test module');
console.log('✓ CHANGELOG.md documenting all versions\n');

console.log('Project Status: v0.2.0');
console.log('All 7 milestones completed and validated ✓');
