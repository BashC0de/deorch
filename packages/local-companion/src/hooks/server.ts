import * as http from 'http';
import type { IncomingMessage, ServerResponse } from 'http';
import { logger } from '../logger.js';
import type {
  HookPayload,
  HookResponse,
  PostToolUsePayload,
  PreToolUsePayload,
  PostToolUseFailurePayload,
  SessionStartPayload,
  UserPromptSubmitPayload,
  StopPayload,
  NotificationPayload,
} from './types.js';
import { classifyRisk, requiresApproval } from './types.js';
import type { PendingApprovals, ApprovalDecision } from '../approval/pending.js';
import type { EventQueue } from '../queue/event-queue.js';
import type { CompanionConfig } from '../config.js';

export interface HookServerDeps {
  config: CompanionConfig;
  pendingApprovals: PendingApprovals;
  eventQueue: EventQueue;
  getSessionId: (externalId: string) => string | undefined;
  createApprovalRequest: (
    sessionId: string | undefined,
    externalSessionId: string,
    toolName: string,
    toolInput: Record<string, unknown>,
    riskLevel: string,
    idempotencyKey: string,
  ) => Promise<{ requestId: string; expiresAt: Date }>;
  emitEvent: (
    externalSessionId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) => Promise<void>;
  ensureSession: (externalSessionId: string) => Promise<void>;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > 1_048_576) reject(new Error('Body too large'));
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: object): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(json) });
  res.end(json);
}

export class HooksServer {
  private server: http.Server;
  private deps: HookServerDeps;
  private sequenceCounters = new Map<string, number>();

  constructor(deps: HookServerDeps) {
    this.deps = deps;
    this.server = http.createServer(this._handleRequest.bind(this));
  }

  private async _handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://localhost`);

    if (req.method === 'GET' && url.pathname === '/hooks/health') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }

    let body: string;
    try {
      body = await readBody(req);
    } catch {
      sendJson(res, 400, { error: 'Bad request body' });
      return;
    }

    let payload: HookPayload;
    try {
      payload = JSON.parse(body) as HookPayload;
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return;
    }

    logger.debug('hook_received', { hook_type: payload.hook_event_name, session: payload.session_id });

    try {
      let response: HookResponse = {};

      switch (payload.hook_event_name) {
        case 'PreToolUse':
          response = await this._handlePreToolUse(payload as PreToolUsePayload);
          break;
        case 'PostToolUse':
          await this._handlePostToolUse(payload as PostToolUsePayload);
          response = { hookSpecificOutput: { hookEventName: 'PostToolUse' } };
          break;
        case 'PostToolUseFailure':
          await this._handlePostToolUseFailure(payload as PostToolUseFailurePayload);
          break;
        case 'SessionStart':
          await this._handleSessionStart(payload as SessionStartPayload);
          break;
        case 'UserPromptSubmit':
          await this._handleUserPromptSubmit(payload as UserPromptSubmitPayload);
          break;
        case 'Stop':
          await this._handleStop(payload as StopPayload);
          break;
        case 'Notification':
          await this._handleNotification(payload as NotificationPayload);
          break;
      }

      sendJson(res, 200, response);
    } catch (err) {
      logger.error('hook_handler_error', { error: String(err) });
      // Fail-closed: deny on any error during PreToolUse
      if (payload.hook_event_name === 'PreToolUse') {
        sendJson(res, 200, {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: 'Internal error in DeOrch companion — action denied for safety',
          },
        });
      } else {
        sendJson(res, 200, {});
      }
    }
  }

  private async _handlePreToolUse(payload: PreToolUsePayload): Promise<HookResponse> {
    const { session_id, tool_name, tool_input } = payload;

    await this.deps.ensureSession(session_id);

    if (!requiresApproval(tool_name, tool_input)) {
      // Observe event, defer to normal permission flow
      await this._emitEvent(session_id, 'tool.pre_use', { tool: tool_name, input: this._redactSecrets(tool_input) });
      return {};
    }

    const riskLevel = classifyRisk(tool_name, tool_input);
    const seq = this._nextSeq(session_id);
    const idempotencyKey = `${session_id}:pre_tool:${tool_name}:${seq}`;

    logger.info('approval_required', { session_id, tool: tool_name, risk: riskLevel });

    const internalSessionId = this.deps.getSessionId(session_id);
    let requestId: string;
    let expiresAt: Date;
    try {
      const result = await this.deps.createApprovalRequest(
        internalSessionId,
        session_id,
        tool_name,
        tool_input,
        riskLevel,
        idempotencyKey,
      );
      requestId = result.requestId;
      expiresAt = result.expiresAt;
    } catch (err) {
      logger.error('approval_request_create_failed', { error: String(err) });
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'Failed to create approval request — action denied for safety',
        },
      };
    }

    const ttlMs = expiresAt.getTime() - Date.now();
    let decision: ApprovalDecision;
    try {
      decision = await this.deps.pendingApprovals.waitForDecision(requestId, ttlMs);
    } catch {
      logger.warn('approval_timeout', { request_id: requestId });
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: 'Approval request timed out — action denied',
        },
      };
    }

    logger.info('approval_decision_received', { request_id: requestId, decision });
    if (decision === 'approve') {
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
        },
      };
    }
    return {
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'Action denied by remote approval decision',
      },
    };
  }

  private async _handleSessionStart(payload: SessionStartPayload): Promise<void> {
    const { session_id, cwd, permission_mode } = payload;
    await this.deps.ensureSession(session_id);
    await this._emitEvent(session_id, 'session.started', {
      cwd: cwd ?? null,
      permission_mode: permission_mode ?? null,
    });
    logger.info('session_start_received', { session_id });
  }

  private async _handlePostToolUse(payload: PostToolUsePayload): Promise<void> {
    const { session_id, tool_name, tool_input, tool_response } = payload;
    await this._emitEvent(session_id, 'tool.post_use', {
      tool: tool_name,
      input: this._redactSecrets(tool_input),
      response: typeof tool_response === 'string' ? tool_response.slice(0, 500) : String(tool_response).slice(0, 500),
    });
  }

  private async _handlePostToolUseFailure(payload: PostToolUseFailurePayload): Promise<void> {
    const { session_id, tool_name, tool_input, tool_response } = payload;
    await this._emitEvent(session_id, 'tool.failed', {
      tool: tool_name,
      input: this._redactSecrets(tool_input),
      error: typeof tool_response === 'string' ? tool_response.slice(0, 500) : String(tool_response ?? '').slice(0, 500),
    });
    logger.info('tool_failure_received', { session_id, tool: tool_name });
  }

  private async _handleUserPromptSubmit(payload: UserPromptSubmitPayload): Promise<void> {
    const { session_id, prompt_text } = payload;
    await this._emitEvent(session_id, 'prompt.submitted', {
      prompt_preview: (prompt_text ?? '').slice(0, 200),
    });
  }

  private async _handleStop(payload: StopPayload): Promise<void> {
    const { session_id } = payload;
    await this._emitEvent(session_id, 'session.ended', { stop_hook_active: payload.stop_hook_active });
    logger.info('session_stop_received', { session_id });
  }

  private async _handleNotification(payload: NotificationPayload): Promise<void> {
    const { session_id, message } = payload;
    await this._emitEvent(session_id, 'notification', { message });
  }

  private async _emitEvent(
    externalSessionId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.deps.emitEvent(externalSessionId, eventType, payload);
    } catch (err) {
      logger.warn('emit_event_failed', { error: String(err), event_type: eventType });
    }
  }

  private _nextSeq(sessionId: string): number {
    const current = this.sequenceCounters.get(sessionId) ?? 0;
    this.sequenceCounters.set(sessionId, current + 1);
    return current;
  }

  private _redactSecrets(input: Record<string, unknown>): Record<string, unknown> {
    const SECRET_PATTERNS = [
      /(?:password|secret|token|key|api_key|auth|credential)[=:\s]+\S+/gi,
      /AKIA[A-Z0-9]{16}/g,
      /gh[ps]_[A-Za-z0-9]{36}/g,
    ];

    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (typeof v === 'string') {
        let redacted = v;
        for (const pattern of SECRET_PATTERNS) {
          redacted = redacted.replace(pattern, '[REDACTED]');
        }
        result[k] = redacted;
      } else {
        result[k] = v;
      }
    }
    return result;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.deps.config.hooksPort, '127.0.0.1', () => {
        logger.info('hooks_server_listening', {
          address: `http://127.0.0.1:${this.deps.config.hooksPort}`,
        });
        resolve();
      });
      this.server.on('error', reject);
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => this.server.close(() => resolve()));
  }
}
