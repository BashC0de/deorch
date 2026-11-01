/**
 * @deorch/adapter-claude-code
 *
 * Claude Code adapter for DeOrch. Handles hooks integration,
 * session detection, and event mapping.
 */

export { ClaudeCodeAdapter } from './adapter.js';
export { DESTRUCTIVE_PATTERNS, requiresApproval, classifyRisk } from './patterns.js';
export { generateHooksConfig } from './hooks-config.js';
