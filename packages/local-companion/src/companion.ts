import * as crypto from 'crypto';
import { logger } from './logger.js';
import type { CompanionConfig } from './config.js';
import { DeOrchWebSocketClient, type WsMessage } from './connection/websocket-client.js';
import { EventQueue } from './queue/event-queue.js';
import { PendingApprovals } from './approval/pending.js';
import { HooksServer } from './hooks/server.js';
import { ServiceMonitor } from './monitors/service-monitor.js';
import { GitMonitor } from './monitors/git-monitor.js';
import { TestObserver } from './monitors/test-observer.js';
import { BuildObserver } from './monitors/build-observer.js';

export class Companion {
  private wsClient: DeOrchWebSocketClient;
  private eventQueue: EventQueue;
  private pendingApprovals: PendingApprovals;
  private hooksServer: HooksServer;
  private serviceMonitor: ServiceMonitor;
  private gitMonitor: GitMonitor;
  readonly testObserver: TestObserver;
  readonly buildObserver: BuildObserver;
  private sessionMap = new Map<string, string>(); // externalId → internalId
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private config: CompanionConfig) {
    this.wsClient = new DeOrchWebSocketClient(config);
    this.eventQueue = new EventQueue(config.sqlitePath);
    this.pendingApprovals = new PendingApprovals();
    this.serviceMonitor = new ServiceMonitor(config);
    this.gitMonitor = new GitMonitor(config);
    this.testObserver = new TestObserver(config);
    this.buildObserver = new BuildObserver(config);

    this.hooksServer = new HooksServer({
      config,
      pendingApprovals: this.pendingApprovals,
      eventQueue: this.eventQueue,
      getSessionId: (extId) => this.sessionMap.get(extId),
      createApprovalRequest: this._createApprovalRequest.bind(this),
      emitEvent: this._emitEvent.bind(this),
      ensureSession: this._ensureSession.bind(this),
      testObserver: this.testObserver,
      buildObserver: this.buildObserver,
    });

    this.wsClient.on('connected', () => this._onConnected());
    this.wsClient.on('disconnected', () => this._onDisconnected());
    this.wsClient.on('message', (msg) => this._onMessage(msg));
    this.wsClient.on('auth_error', (reason) => {
      logger.error('ws_auth_error_fatal', { reason });
      // Graceful shutdown: clean up resources before exiting
      void this.stop().finally(() => process.exit(1));
    });
  }

  async start(): Promise<void> {
    logger.info('companion_starting', {
      device_id: this.config.deviceId ? '***set***' : 'NOT SET',
      ws_url: this.config.wsUrl,
      hooks_port: this.config.hooksPort,
    });

    if (!this.config.deviceId || !this.config.deviceSecret) {
      logger.warn('companion_not_paired', {
        message: 'COMPANION_DEVICE_ID or COMPANION_DEVICE_SECRET not set. Run the pairing flow first.',
      });
    }

    // Prune old delivered events on startup
    const pruned = this.eventQueue.pruneDelivered(7);
    if (pruned > 0) logger.info('event_queue_pruned', { count: pruned });

    await this.hooksServer.start();
    await this.wsClient.connect();

    // Periodic cleanup of expired pending approvals
    this.cleanupTimer = setInterval(() => this.pendingApprovals.cleanup(), 30_000);

    // Start development intelligence monitors
    await this.serviceMonitor.start();
    this.gitMonitor.start();

    logger.info('companion_ready', { hooks: `http://127.0.0.1:${this.config.hooksPort}` });
  }

  async stop(): Promise<void> {
    logger.info('companion_stopping');
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.serviceMonitor.stop();
    this.gitMonitor.stop();
    await this.hooksServer.stop();
    this.wsClient.destroy();
    this.eventQueue.close();
  }

  private async _onConnected(): Promise<void> {
    logger.info('companion_ws_connected');
    await this._flushQueue();
  }

  private _onDisconnected(): void {
    logger.info('companion_ws_disconnected');
    // Reject all pending approvals — fail-closed on disconnect
    this.pendingApprovals.rejectAll('Device disconnected from backend');
  }

  private _onMessage(msg: WsMessage): void {
    switch (msg.type) {
      case 'approval_decision': {
        const payload = msg.payload as {
          request_id: string;
          decision: string;
          decided_by?: string;
        };
        const { request_id, decision } = payload;

        // Replay protection
        if (this.eventQueue.hasSeenDecisionId(msg.id)) {
          logger.warn('approval_decision_replay_detected', { msg_id: msg.id, request_id });
          return;
        }
        this.eventQueue.recordSeenDecisionId(msg.id);

        const resolvedDecision = decision === 'approve' ? 'approve' : 'deny';
        const resolved = this.pendingApprovals.resolveDecision(request_id, resolvedDecision);
        if (!resolved) {
          logger.warn('approval_decision_no_pending', { request_id });
        }

        // Acknowledge delivery
        this.wsClient.send({
          type: 'approval_response',
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          payload: { request_id, received: true },
        }).catch(() => {});
        break;
      }

      case 'pong':
        break;

      default:
        logger.debug('ws_unknown_message', { type: msg.type });
    }
  }

  private async _flushQueue(): Promise<void> {
    const events = this.eventQueue.dequeue(100);
    if (events.length === 0) return;
    logger.info('flushing_event_queue', { count: events.length });

    for (const event of events) {
      try {
        const msg = JSON.parse(event.payload) as object;
        await this.wsClient.send(msg);
        this.eventQueue.markDelivered(event.id);
      } catch (err) {
        logger.warn('flush_event_failed', { id: event.id, error: String(err) });
        this.eventQueue.markFailed(event.id);
      }
    }
  }

  private async _ensureSession(externalSessionId: string): Promise<void> {
    if (this.sessionMap.has(externalSessionId)) return;

    // Create session in backend
    try {
      const resp = await fetch(`${this.config.apiUrl}/api/v1/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.deviceId}:${this.config.deviceSecret}`,
        },
        body: JSON.stringify({
          provider_slug: this.config.providerSlug,
          external_session_id: externalSessionId,
        }),
      });

      if (resp.ok) {
        const data = await resp.json() as { id: string };
        this.sessionMap.set(externalSessionId, data.id);
        logger.info('session_created', { external: externalSessionId, internal: data.id });
      } else {
        logger.warn('session_create_failed', { status: resp.status });
      }
    } catch (err) {
      logger.warn('session_create_error', { error: String(err) });
    }
  }

  private async _createApprovalRequest(
    sessionId: string | undefined,
    externalSessionId: string,
    toolName: string,
    toolInput: Record<string, unknown>,
    riskLevel: string,
    idempotencyKey: string,
  ): Promise<{ requestId: string; expiresAt: Date }> {
    // Determine action category from tool name
    const actionCategory = toolName === 'Bash' ? 'shell_command'
      : toolName === 'Write' ? 'file_write'
      : toolName === 'Edit' ? 'file_edit'
      : 'tool_use';

    const resp = await fetch(`${this.config.apiUrl}/api/v1/approvals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.deviceId}:${this.config.deviceSecret}`,
      },
      body: JSON.stringify({
        session_id: sessionId ?? null,
        request_type: 'tool_use',
        hook_event_name: 'PreToolUse',
        tool_name: toolName,
        action_category: actionCategory,
        action_summary: `Execute ${toolName}: ${String(toolInput['command'] ?? JSON.stringify(toolInput)).slice(0, 100)}`,
        details: { tool: toolName, input: toolInput },
        working_directory: null,
        risk_level: riskLevel,
        idempotency_key: idempotencyKey,
        ttl_seconds: 300,
      }),
    });

    if (!resp.ok) {
      throw new Error(`Backend returned ${resp.status} when creating approval request`);
    }

    const data = await resp.json() as { id: string; expires_at: string };
    return { requestId: data.id, expiresAt: new Date(data.expires_at) };
  }

  private async _emitEvent(
    externalSessionId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const internalSessionId = this.sessionMap.get(externalSessionId);
    if (!internalSessionId) return;

    const seq = Date.now(); // Simple sequence number for events
    const idempotencyKey = `${internalSessionId}:${eventType}:${seq}`;
    const id = crypto.randomUUID();

    const msg = {
      type: 'agent_event',
      id,
      timestamp: new Date().toISOString(),
      payload: {
        session_id: internalSessionId,
        event_type: eventType,
        event_data: payload,
        sequence_number: seq,
        idempotency_key: idempotencyKey,
      },
    };

    if (this.wsClient.isConnected()) {
      try {
        await this.wsClient.send(msg);
        return;
      } catch {
        // Fall through to queue
      }
    }

    // Queue for later delivery
    this.eventQueue.enqueue({
      id,
      event_type: eventType,
      payload: JSON.stringify(msg),
      idempotency_key: idempotencyKey,
      created_at: Date.now(),
    });
  }
}
