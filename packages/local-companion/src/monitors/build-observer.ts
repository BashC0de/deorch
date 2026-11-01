import { logger } from '../logger.js';
import type { CompanionConfig } from '../config.js';

const BUILD_COMMAND_PATTERNS: Array<{ pattern: RegExp; buildType: string }> = [
  { pattern: /\bnpm\s+run\s+build\b/, buildType: 'npm' },
  { pattern: /\bpnpm\s+(run\s+)?build\b/, buildType: 'pnpm' },
  { pattern: /\byarn\s+(run\s+)?build\b/, buildType: 'yarn' },
  { pattern: /\bnext\s+build\b/, buildType: 'nextjs' },
  { pattern: /\btsc\b/, buildType: 'typescript' },
  { pattern: /\bcargo\s+build\b/, buildType: 'cargo' },
  { pattern: /\bgo\s+build\b/, buildType: 'go' },
  { pattern: /\bmake\b/, buildType: 'make' },
  { pattern: /\bgcc\b|\bg\+\+\b/, buildType: 'gcc' },
];

const LINT_COMMAND_PATTERNS: Array<{ pattern: RegExp; buildType: string }> = [
  { pattern: /\beslint\b/, buildType: 'eslint' },
  { pattern: /\bruff\b/, buildType: 'ruff' },
  { pattern: /\bpylint\b/, buildType: 'pylint' },
  { pattern: /\bmypy\b/, buildType: 'mypy' },
  { pattern: /\bprettier\b.*--check/, buildType: 'prettier' },
];

export class BuildObserver {
  constructor(private config: CompanionConfig) {}

  /** Detect if a command is a build execution */
  detectBuildCommand(command: string): string | null {
    for (const { pattern, buildType } of BUILD_COMMAND_PATTERNS) {
      if (pattern.test(command)) return buildType;
    }
    for (const { pattern, buildType } of LINT_COMMAND_PATTERNS) {
      if (pattern.test(command)) return buildType;
    }
    return null;
  }

  /** Submit build result to backend */
  async submitBuildResult(
    buildType: string,
    command: string,
    exitCode: number | null,
    output: string,
    durationMs?: number,
    sessionId?: string,
  ): Promise<void> {
    const status = exitCode === 0 ? 'SUCCESS' : exitCode !== null ? 'FAILURE' : 'UNKNOWN';

    try {
      await fetch(`${this.config.apiUrl}/api/v1/build-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.deviceId}:${this.config.deviceSecret}`,
        },
        body: JSON.stringify({
          session_id: sessionId ?? null,
          build_type: buildType,
          command: command.slice(0, 500),
          exit_code: exitCode,
          status,
          error_output: status === 'FAILURE' ? output.slice(0, 5000) : null,
          duration_ms: durationMs ?? null,
        }),
      });
    } catch (err) {
      logger.warn('build_result_submit_failed', { error: String(err) });
    }
  }
}
