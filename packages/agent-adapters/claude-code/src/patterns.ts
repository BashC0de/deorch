/**
 * Patterns that indicate a destructive or sensitive operation
 * requiring remote approval before execution.
 */
export const DESTRUCTIVE_PATTERNS: RegExp[] = [
  /\brm\s+-[rf]+/,
  /\brm\s+--recursive/,
  /\brmdir\b/,
  /\bgit\s+reset\s+--hard/,
  /\bgit\s+clean\s+-[fdx]+/,
  /\bgit\s+push\s+--force/,
  /\bgit\s+push\s+-f\b/,
  /\bDROP\s+TABLE\b/i,
  /\bDELETE\s+FROM\b/i,
  /\bkill\s+-9/,
  /\bkillall\b/,
  /\bpkill\b/,
  /\bchmod\s+-R\b/,
  /\bchown\s+-R\b/,
  /\bdd\s+if=/,
];

/**
 * Check if a tool call requires remote approval.
 */
export function requiresApproval(toolName: string, toolInput: Record<string, unknown>): boolean {
  if (toolName === 'Bash') {
    const cmd = String(toolInput['command'] ?? '');
    return DESTRUCTIVE_PATTERNS.some((p) => p.test(cmd));
  }
  return false;
}

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Classify the risk level of a tool call.
 */
export function classifyRisk(toolName: string, toolInput: Record<string, unknown>): RiskLevel {
  if (toolName !== 'Bash') return 'LOW';
  const cmd = String(toolInput['command'] ?? '');
  if (/\brm\s+-rf\s+\//.test(cmd) || /\bdd\s+if=/.test(cmd)) return 'CRITICAL';
  if (/\brm\s+-[rf]+/.test(cmd) || /\bgit\s+push\s+--force/.test(cmd) || /\bgit\s+reset\s+--hard/.test(cmd)) return 'HIGH';
  if (/\bkill\b/.test(cmd) || /\bchmod\s+-R/.test(cmd)) return 'MEDIUM';
  return 'LOW';
}
