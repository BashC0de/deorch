import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../logger.js';

export interface QueuedEvent {
  id: string;
  event_type: string;
  payload: string;
  idempotency_key: string;
  created_at: number;
  delivered: boolean;
  attempts: number;
}

interface QueueData {
  events: QueuedEvent[];
  seenDecisionIds: string[];
}

/**
 * Simple JSON file-backed event queue.
 * No native dependencies — works on any platform.
 */
export class EventQueue {
  private data: QueueData = { events: [], seenDecisionIds: [] };
  private filePath: string;
  private dirty = false;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  constructor(dbPath: string) {
    // Use .json instead of .db
    this.filePath = dbPath.replace(/\.db$/, '.json');
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this._load();
    // Persist every 5 seconds if dirty
    this.flushTimer = setInterval(() => this._persist(), 5000);
  }

  enqueue(event: Omit<QueuedEvent, 'delivered' | 'attempts'>): void {
    const existing = this.data.events.find((e) => e.idempotency_key === event.idempotency_key);
    if (existing) return;
    this.data.events.push({ ...event, delivered: false, attempts: 0 });
    this.dirty = true;
  }

  dequeue(limit = 50): QueuedEvent[] {
    return this.data.events
      .filter((e) => !e.delivered)
      .sort((a, b) => a.created_at - b.created_at)
      .slice(0, limit);
  }

  markDelivered(id: string): void {
    const event = this.data.events.find((e) => e.id === id);
    if (event) {
      event.delivered = true;
      this.dirty = true;
    }
  }

  markFailed(id: string): void {
    const event = this.data.events.find((e) => e.id === id);
    if (event) {
      event.attempts++;
      this.dirty = true;
    }
  }

  pruneDelivered(olderThanDays = 7): number {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const before = this.data.events.length;
    this.data.events = this.data.events.filter(
      (e) => !(e.delivered && e.created_at < cutoff),
    );
    const pruned = before - this.data.events.length;
    if (pruned > 0) this.dirty = true;
    return pruned;
  }

  size(): number {
    return this.data.events.filter((e) => !e.delivered).length;
  }

  hasSeenDecisionId(messageId: string): boolean {
    return this.data.seenDecisionIds.includes(messageId);
  }

  recordSeenDecisionId(messageId: string): void {
    if (!this.data.seenDecisionIds.includes(messageId)) {
      this.data.seenDecisionIds.push(messageId);
      // Keep last 1000
      if (this.data.seenDecisionIds.length > 1000) {
        this.data.seenDecisionIds = this.data.seenDecisionIds.slice(-1000);
      }
      this.dirty = true;
    }
  }

  close(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this._persist();
  }

  private _load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(raw) as QueueData;
      }
    } catch (err) {
      logger.warn('event_queue_load_error', { error: String(err) });
      this.data = { events: [], seenDecisionIds: [] };
    }
  }

  private _persist(): void {
    if (!this.dirty) return;
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
      this.dirty = false;
    } catch (err) {
      logger.warn('event_queue_persist_error', { error: String(err) });
    }
  }
}
