export const QUEUE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS queued_events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    idempotency_key TEXT UNIQUE NOT NULL,
    created_at INTEGER NOT NULL,
    delivered INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_queued_events_delivered ON queued_events(delivered);
  CREATE INDEX IF NOT EXISTS idx_queued_events_created_at ON queued_events(created_at);

  CREATE TABLE IF NOT EXISTS seen_decision_ids (
    message_id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL
  );
`;

export interface QueuedEvent {
  id: string;
  event_type: string;
  payload: string;
  idempotency_key: string;
  created_at: number;
  delivered: number;
  attempts: number;
  last_attempt_at: number | null;
}
