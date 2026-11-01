import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventQueue } from '../queue/event-queue.js';

let tmpDir: string;
let queue: EventQueue;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deorch-queue-test-'));
  queue = new EventQueue(path.join(tmpDir, 'test.db'));
});

afterEach(() => {
  queue.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('EventQueue', () => {
  it('enqueues and dequeues events', () => {
    queue.enqueue({
      id: 'evt-1',
      event_type: 'test',
      payload: '{"data": true}',
      idempotency_key: 'key-1',
      created_at: Date.now(),
    });

    const events = queue.dequeue();
    expect(events).toHaveLength(1);
    expect(events[0]!.id).toBe('evt-1');
    expect(events[0]!.delivered).toBe(false);
  });

  it('deduplicates by idempotency key', () => {
    const event = {
      id: 'evt-1',
      event_type: 'test',
      payload: '{}',
      idempotency_key: 'dup-key',
      created_at: Date.now(),
    };
    queue.enqueue(event);
    queue.enqueue({ ...event, id: 'evt-2' }); // same idempotency key

    expect(queue.size()).toBe(1);
  });

  it('marks events as delivered', () => {
    queue.enqueue({
      id: 'evt-1',
      event_type: 'test',
      payload: '{}',
      idempotency_key: 'key-1',
      created_at: Date.now(),
    });

    queue.markDelivered('evt-1');
    expect(queue.size()).toBe(0);
    expect(queue.dequeue()).toHaveLength(0);
  });

  it('marks events as failed and increments attempts', () => {
    queue.enqueue({
      id: 'evt-1',
      event_type: 'test',
      payload: '{}',
      idempotency_key: 'key-1',
      created_at: Date.now(),
    });

    queue.markFailed('evt-1');
    queue.markFailed('evt-1');

    const events = queue.dequeue();
    expect(events[0]!.attempts).toBe(2);
  });

  it('prunes old delivered events', () => {
    const oldTime = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days ago
    queue.enqueue({
      id: 'old',
      event_type: 'test',
      payload: '{}',
      idempotency_key: 'old-key',
      created_at: oldTime,
    });
    queue.markDelivered('old');

    const pruned = queue.pruneDelivered(7);
    expect(pruned).toBe(1);
  });

  it('tracks seen decision IDs for replay protection', () => {
    expect(queue.hasSeenDecisionId('msg-1')).toBe(false);
    queue.recordSeenDecisionId('msg-1');
    expect(queue.hasSeenDecisionId('msg-1')).toBe(true);
  });

  it('respects dequeue limit', () => {
    for (let i = 0; i < 10; i++) {
      queue.enqueue({
        id: `evt-${i}`,
        event_type: 'test',
        payload: '{}',
        idempotency_key: `key-${i}`,
        created_at: Date.now() + i,
      });
    }

    const events = queue.dequeue(3);
    expect(events).toHaveLength(3);
  });
});
