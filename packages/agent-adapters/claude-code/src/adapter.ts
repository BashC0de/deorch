import { requiresApproval, classifyRisk, type RiskLevel } from './patterns.js';

/**
 * Hook payload types as sent by Claude Code.
 */
export interface PreToolUsePayload {
  session_id: string;
  hook_event_name: 'PreToolUse';
  tool_name: string;
  tool_input: Record<string, unknown>;
  transcript_path?: string;
}

export interface PostToolUsePayload {
  session_id: string;
  hook_event_name: 'PostToolUse';
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response: unknown;
  transcript_path?: string;
}

export interface StopPayload {
  session_id: string;
  hook_event_name: 'Stop';
  stop_hook_active: boolean;
}

export interface NotificationPayload {
  session_id: string;
  hook_event_name: 'Notification';
  message: string;
}

export type HookPayload = PreToolUsePayload | PostToolUsePayload | StopPayload | NotificationPayload;

export interface HookResponse {
  continue: boolean;
  stopReason?: string | null;
}

/**
 * Result of processing a hook event.
 */
export interface ProcessResult {
  response: HookResponse;
  event?: {
    type: string;
    payload: Record<string, unknown>;
  };
  approvalRequired?: {
    toolName: string;
    toolInput: Record<string, unknown>;
    riskLevel: RiskLevel;
    summary: string;
  };
}

/**
 * Claude Code adapter — stateless processor for hook payloads.
 * Determines whether to approve, deny, or observe each hook event.
 */
export class ClaudeCodeAdapter {
  static readonly slug = 'claude-code';
  static readonly displayName = 'Claude Code';
  static readonly capabilities = [
    'pre_tool_approval',
    'post_tool_observe',
    'session_tracking',
    'notifications',
  ] as const;

  /**
   * Process a PreToolUse hook — decide if approval is required.
   */
  processPreToolUse(payload: PreToolUsePayload): ProcessResult {
    const { tool_name, tool_input } = payload;

    if (requiresApproval(tool_name, tool_input)) {
      const riskLevel = classifyRisk(tool_name, tool_input);
      const cmd = String(tool_input['command'] ?? JSON.stringify(tool_input));
      return {
        response: { continue: false, stopReason: 'Awaiting remote approval...' },
        approvalRequired: {
          toolName: tool_name,
          toolInput: tool_input,
          riskLevel,
          summary: `Execute ${tool_name}: ${cmd.slice(0, 100)}`,
        },
      };
    }

    return {
      response: { continue: true },
      event: {
        type: 'tool.pre_use',
        payload: { tool: tool_name },
      },
    };
  }

  /**
   * Process a PostToolUse hook — observe the result.
   */
  processPostToolUse(payload: PostToolUsePayload): ProcessResult {
    const responseStr = typeof payload.tool_response === 'string'
      ? payload.tool_response.slice(0, 500)
      : String(payload.tool_response).slice(0, 500);

    return {
      response: { continue: true },
      event: {
        type: 'tool.post_use',
        payload: {
          tool: payload.tool_name,
          response_preview: responseStr,
        },
      },
    };
  }

  /**
   * Process a Stop hook — session is ending.
   */
  processStop(payload: StopPayload): ProcessResult {
    return {
      response: { continue: true },
      event: {
        type: 'session.ended',
        payload: { stop_hook_active: payload.stop_hook_active },
      },
    };
  }

  /**
   * Process a Notification hook — informational message.
   */
  processNotification(payload: NotificationPayload): ProcessResult {
    return {
      response: { continue: true },
      event: {
        type: 'notification',
        payload: { message: payload.message },
      },
    };
  }
}
