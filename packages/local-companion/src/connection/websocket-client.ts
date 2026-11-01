import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { logger } from '../logger.js';
import { ReconnectStrategy } from './reconnect.js';
import type { CompanionConfig } from '../config.js';

export type WsMessage = {
  type: string;
  id: string;
  timestamp: string;
  payload: Record<string, unknown>;
};

type ClientEvents = {
  connected: [];
  disconnected: [code: number, reason: string];
  message: [msg: WsMessage];
  auth_error: [reason: string];
};

export class DeOrchWebSocketClient extends EventEmitter<ClientEvents> {
  private ws: WebSocket | null = null;
  private _connected = false;
  private reconnect: ReconnectStrategy;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(private config: CompanionConfig) {
    super();
    this.reconnect = new ReconnectStrategy(
      config.reconnectInitialDelayMs,
      config.reconnectMaxDelayMs,
      config.reconnectMaxAttempts,
    );
  }

  async connect(): Promise<void> {
    if (this.destroyed) return;

    const ws = new WebSocket(this.config.wsUrl, {
      handshakeTimeout: 10000,
    });
    this.ws = ws;

    ws.on('open', () => {
      logger.info('ws_connected', { url: this.config.wsUrl });
      this.reconnect.reset();
      this._startHeartbeat();
    });

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsMessage;
        this._handleMessage(msg);
      } catch (err) {
        logger.warn('ws_parse_error', { error: String(err) });
      }
    });

    ws.on('close', (code, reason) => {
      this._stopHeartbeat();
      const wasConnected = this._connected;
      this._connected = false;
      this.ws = null;
      logger.info('ws_disconnected', { code, reason: reason.toString() });
      if (wasConnected) {
        this.emit('disconnected', code, reason.toString());
      }
      this._scheduleReconnect();
    });

    ws.on('error', (err) => {
      logger.error('ws_error', { error: String(err) });
    });

    ws.on('pong', () => {
      if (this.pongTimer) {
        clearTimeout(this.pongTimer);
        this.pongTimer = null;
      }
    });
  }

  private _handleMessage(msg: WsMessage): void {
    switch (msg.type) {
      case 'auth_required':
        // Send device credentials
        this._sendRaw({
          type: 'auth_token',
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          payload: {
            device_id: this.config.deviceId,
            device_secret: this.config.deviceSecret,
            provider_slug: this.config.providerSlug,
          },
        });
        break;

      case 'auth_ok':
        this._connected = true;
        logger.info('ws_authenticated', { device_id: this.config.deviceId });
        this.emit('connected');
        break;

      case 'auth_error':
        logger.error('ws_auth_failed', { reason: msg.payload['reason'] });
        this.emit('auth_error', String(msg.payload['reason'] ?? 'unknown'));
        this.ws?.close();
        break;

      case 'ping':
        this._sendRaw({
          type: 'pong',
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          payload: { ping_id: msg.id },
        });
        break;

      default:
        this.emit('message', msg);
    }
  }

  private _sendRaw(msg: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  async send(msg: object): Promise<void> {
    this._sendRaw(msg);
  }

  private _startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) return;
      this.ws.ping();
      this.pongTimer = setTimeout(() => {
        logger.warn('ws_pong_timeout');
        this.ws?.terminate();
      }, this.config.wsPongTimeoutMs);
    }, this.config.wsHeartbeatIntervalMs);
  }

  private _stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private _scheduleReconnect(): void {
    if (this.destroyed) return;
    if (!this.reconnect.shouldRetry()) {
      logger.error('ws_max_reconnect_attempts_reached');
      return;
    }
    const delay = this.reconnect.nextDelay();
    logger.info('ws_reconnecting', { delay_ms: delay, attempt: this.reconnect.attemptCount });
    setTimeout(() => this.connect(), delay);
  }

  isConnected(): boolean {
    return this._connected;
  }

  destroy(): void {
    this.destroyed = true;
    this._stopHeartbeat();
    this.ws?.close();
  }
}
