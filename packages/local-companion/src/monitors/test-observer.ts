import { logger } from '../logger.js';
import type { CompanionConfig } from '../config.js';

interface TestResult {
  framework: string;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs?: number;
  failures: Array<{ name: string; message: string }>;
  status: string;
}

const TEST_COMMAND_PATTERNS: Array<{ pattern: RegExp; framework: string }> = [
  { pattern: /\bvitest\b/, framework: 'vitest' },
  { pattern: /\bjest\b/, framework: 'jest' },
  { pattern: /\bpytest\b/, framework: 'pytest' },
  { pattern: /\bplaywright\b/, framework: 'playwright' },
  { pattern: /\bmocha\b/, framework: 'mocha' },
  { pattern: /\bcargo\s+test\b/, framework: 'cargo-test' },
  { pattern: /\bgo\s+test\b/, framework: 'go-test' },
];

export class TestObserver {
  constructor(private config: CompanionConfig) {}

  /** Detect if a command is a test execution */
  detectTestCommand(command: string): string | null {
    for (const { pattern, framework } of TEST_COMMAND_PATTERNS) {
      if (pattern.test(command)) return framework;
    }
    return null;
  }

  /** Parse test results from tool output */
  parseTestOutput(framework: string, output: string): TestResult | null {
    switch (framework) {
      case 'vitest':
      case 'jest':
        return this.parseJestVitestOutput(framework, output);
      case 'pytest':
        return this.parsePytestOutput(output);
      default:
        return this.parseGenericOutput(framework, output);
    }
  }

  private parseJestVitestOutput(framework: string, output: string): TestResult | null {
    // Look for the "Tests" summary line (not "Test Files")
    const testsLine = output.match(/^\s*Tests\s+.*?(\d+)\s+passed/m);
    const passMatch = testsLine ?? output.match(/(\d+)\s+passed/);
    const testsFailLine = output.match(/^\s*Tests\s+.*?(\d+)\s+failed/m);
    const failMatch = testsFailLine ?? output.match(/(\d+)\s+failed/);
    const skipMatch = output.match(/(\d+)\s+skipped/);
    const durationMatch = output.match(/Duration\s+([\d.]+)s/i) ?? output.match(/Time:\s+([\d.]+)\s*s/i);

    const passed = passMatch ? parseInt(passMatch[1]!, 10) : 0;
    const failed = failMatch ? parseInt(failMatch[1]!, 10) : 0;
    const skipped = skipMatch ? parseInt(skipMatch[1]!, 10) : 0;
    const total = passed + failed + skipped;

    if (total === 0) return null;

    const durationMs = durationMatch ? Math.round(parseFloat(durationMatch[1]!) * 1000) : undefined;

    // Extract failure names
    const failures: Array<{ name: string; message: string }> = [];
    const failureBlocks = output.match(/FAIL\s+(.+)/g);
    if (failureBlocks) {
      for (const block of failureBlocks.slice(0, 10)) {
        failures.push({ name: block.replace('FAIL ', '').trim(), message: '' });
      }
    }

    return {
      framework,
      total,
      passed,
      failed,
      skipped,
      durationMs,
      failures,
      status: failed > 0 ? 'FAILED' : 'PASSED',
    };
  }

  private parsePytestOutput(output: string): TestResult | null {
    // Match "X passed, Y failed, Z skipped" or "X passed in Y.XXs"
    const summaryMatch = output.match(/(\d+)\s+passed/);
    const failMatch = output.match(/(\d+)\s+failed/);
    const skipMatch = output.match(/(\d+)\s+skipped/);
    const durationMatch = output.match(/in\s+([\d.]+)s/);

    const passed = summaryMatch ? parseInt(summaryMatch[1]!, 10) : 0;
    const failed = failMatch ? parseInt(failMatch[1]!, 10) : 0;
    const skipped = skipMatch ? parseInt(skipMatch[1]!, 10) : 0;
    const total = passed + failed + skipped;

    if (total === 0) return null;

    return {
      framework: 'pytest',
      total,
      passed,
      failed,
      skipped,
      durationMs: durationMatch ? Math.round(parseFloat(durationMatch[1]!) * 1000) : undefined,
      failures: [],
      status: failed > 0 ? 'FAILED' : 'PASSED',
    };
  }

  private parseGenericOutput(framework: string, output: string): TestResult | null {
    // Try generic patterns
    const passMatch = output.match(/(\d+)\s+pass/i);
    const failMatch = output.match(/(\d+)\s+fail/i);
    if (!passMatch && !failMatch) return null;

    const passed = passMatch ? parseInt(passMatch[1]!, 10) : 0;
    const failed = failMatch ? parseInt(failMatch[1]!, 10) : 0;

    return {
      framework,
      total: passed + failed,
      passed,
      failed,
      skipped: 0,
      failures: [],
      status: failed > 0 ? 'FAILED' : 'PASSED',
    };
  }

  /** Submit test results to backend */
  async submitTestRun(result: TestResult, sessionId?: string): Promise<void> {
    try {
      await fetch(`${this.config.apiUrl}/api/v1/test-runs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.deviceId}:${this.config.deviceSecret}`,
        },
        body: JSON.stringify({
          session_id: sessionId ?? null,
          framework: result.framework,
          total_tests: result.total,
          passed: result.passed,
          failed: result.failed,
          skipped: result.skipped,
          duration_ms: result.durationMs ?? null,
          status: result.status,
          failures: result.failures,
        }),
      });
    } catch (err) {
      logger.warn('test_run_submit_failed', { error: String(err) });
    }
  }
}
