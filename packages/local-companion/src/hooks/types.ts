export type HookEventName =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'PostToolUseFailure'
  | 'SessionStart'
  | 'UserPromptSubmit'
  | 'Stop'
  | 'Notification';

export interface HookBase {
  session_id: string;
  hook_event_name: HookEventName;
  transcript_path?: string;
}

export interface PreToolUsePayload extends HookBase {
  hook_event_name: 'PreToolUse';
  tool_name: string;
  tool_input: Record<string, unknown>;
}

export interface PostToolUsePayload extends HookBase {
  hook_event_name: 'PostToolUse';
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response: unknown;
}

export interface StopPayload extends HookBase {
  hook_event_name: 'Stop';
  stop_hook_active: boolean;
}

export interface NotificationPayload extends HookBase {
  hook_event_name: 'Notification';
  message: string;
}

export interface SessionStartPayload extends HookBase {
  hook_event_name: 'SessionStart';
  cwd?: string;
  permission_mode?: string;
}

export interface PostToolUseFailurePayload extends HookBase {
  hook_event_name: 'PostToolUseFailure';
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response?: unknown;
}

export interface UserPromptSubmitPayload extends HookBase {
  hook_event_name: 'UserPromptSubmit';
  prompt_text?: string;
}

export type HookPayload =
  | PreToolUsePayload
  | PostToolUsePayload
  | StopPayload
  | NotificationPayload
  | SessionStartPayload
  | PostToolUseFailurePayload
  | UserPromptSubmitPayload;

/**
 * Modern Claude Code hook output format using hookSpecificOutput.
 * The old {continue, stopReason} format is deprecated.
 */
export interface PreToolUseOutput {
  hookEventName: 'PreToolUse';
  permissionDecision: 'allow' | 'deny' | 'ask' | 'defer';
  permissionDecisionReason?: string;
  updatedInput?: Record<string, unknown>;
  additionalContext?: string;
}

export interface PostToolUseOutput {
  hookEventName: 'PostToolUse';
  updatedToolOutput?: string;
  additionalContext?: string;
}

export interface StopOutput {
  hookEventName: 'Stop';
  additionalContext?: string;
}

export type HookSpecificOutput = PreToolUseOutput | PostToolUseOutput | StopOutput;

/** Response written to stdout for Claude Code to read */
export interface HookResponse {
  hookSpecificOutput?: HookSpecificOutput;
  /** @deprecated Legacy format — use hookSpecificOutput instead */
  continue?: boolean;
  /** @deprecated Legacy format — use hookSpecificOutput instead */
  stopReason?: string | null;
}

/** Patterns that trigger a remote approval request */
export const DESTRUCTIVE_PATTERNS = [
  /\brm\s+-[rf]+/,
  /\brm\s+--recursive/,
  /\brmdir\b/,
  /\bgit\s+reset\s+--hard/,
  /\bgit\s+clean\s+-[fdx]+/,
  /\bgit\s+push\s+--force/,
  /\bgit\s+push\s+-f\b/,
  /\bDROP\s+TABLE\b/i,
  /\bDELETE\s+FROM\b.*(?!WHERE)/i,
  /\bkill\b/,
  /\bkillall\b/,
  /\bpkill\b/,
  /\bchmod\s+-R\b/,
  /\bchown\s+-R\b/,
  /\bformat\b/,
  /\bdd\s+if=/,
];

export function requiresApproval(toolName: string, toolInput: Record<string, unknown>): boolean {
  if (toolName === 'Bash') {
    const cmd = String(toolInput['command'] ?? '');
    return DESTRUCTIVE_PATTERNS.some((pattern) => pattern.test(cmd));
  }
  return false;
}

export function classifyRisk(toolName: string, toolInput: Record<string, unknown>): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  if (toolName !== 'Bash') return 'LOW';
  const cmd = String(toolInput['command'] ?? '');
  if (/\brm\s+-rf\s+\//.test(cmd) || /\bdd\s+if=/.test(cmd)) return 'CRITICAL';
  if (/\brm\s+-[rf]+/.test(cmd) || /\bgit\s+push\s+--force/.test(cmd)) return 'HIGH';
  return 'MEDIUM';
}
