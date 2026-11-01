import { describe, it, expect } from 'vitest';
import type { HookResponse, PreToolUseOutput } from '../hooks/types.js';

describe('Hook response format', () => {
  it('produces correct allow response with hookSpecificOutput', () => {
    const response: HookResponse = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
      },
    };
    expect(response.hookSpecificOutput).toBeDefined();
    const output = response.hookSpecificOutput as PreToolUseOutput;
    expect(output.hookEventName).toBe('PreToolUse');
    expect(output.permissionDecision).toBe('allow');
    expect(output.permissionDecisionReason).toBeUndefined();
  });

  it('produces correct deny response with reason', () => {
    const response: HookResponse = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'Action denied by remote approval decision',
      },
    };
    const output = response.hookSpecificOutput as PreToolUseOutput;
    expect(output.permissionDecision).toBe('deny');
    expect(output.permissionDecisionReason).toBe('Action denied by remote approval decision');
  });

  it('produces empty response for defer (no approval needed)', () => {
    const response: HookResponse = {};
    expect(response.hookSpecificOutput).toBeUndefined();
    expect(response.continue).toBeUndefined();
  });

  it('produces correct fail-closed deny on error', () => {
    const response: HookResponse = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'Internal error in DeOrch companion — action denied for safety',
      },
    };
    const output = response.hookSpecificOutput as PreToolUseOutput;
    expect(output.permissionDecision).toBe('deny');
    expect(output.permissionDecisionReason).toContain('Internal error');
  });

  it('produces correct timeout deny response', () => {
    const response: HookResponse = {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'Approval request timed out — action denied',
      },
    };
    const output = response.hookSpecificOutput as PreToolUseOutput;
    expect(output.permissionDecision).toBe('deny');
    expect(output.permissionDecisionReason).toContain('timed out');
  });

  it('produces correct PostToolUse observe response', () => {
    const response: HookResponse = {
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
      },
    };
    expect(response.hookSpecificOutput!.hookEventName).toBe('PostToolUse');
  });
});
