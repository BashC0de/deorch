/**
 * @deorch/shared-contracts
 *
 * Shared type definitions used by the local companion and web dashboard.
 */

// ── WebSocket Message Envelope ──────────────────────────────────────────────

export interface WsMessage<T extends string = string, P = Record<string, unknown>> {
  type: T;
  id: string;
  timestamp: string;
  payload: P;
}

// ── WebSocket Message Types ─────────────────────────────────────────────────

export type AuthRequiredMessage = WsMessage<'auth_required', Record<string, never>>;
export type AuthTokenMessage = WsMessage<'auth_token', { token?: string; device_id?: string; device_secret?: string }>;
export type AuthOkMessage = WsMessage<'auth_ok', { user_id?: string; device_id?: string }>;
export type AuthErrorMessage = WsMessage<'auth_error', { reason: string }>;
export type PingMessage = WsMessage<'ping', Record<string, never>>;
export type PongMessage = WsMessage<'pong', { ping_id: string }>;

export type ApprovalRequestMessage = WsMessage<'approval_request', {
  request_id: string;
  session_id: string | null;
  device_id: string;
  device_name: string;
  agent: string;
  action_summary: string;
  details: Record<string, unknown>;
  working_directory: string | null;
  reason: string | null;
  risk_level: RiskLevel | null;
  expires_at: string;
}>;

export type ApprovalDecisionMessage = WsMessage<'approval_decision', {
  request_id: string;
  decision: 'approve' | 'deny';
  decided_by: string;
  decided_at: string;
  reason?: string | null;
}>;

export type ApprovalResponseMessage = WsMessage<'approval_response', {
  request_id: string;
  received: boolean;
}>;

export type DeviceConnectedMessage = WsMessage<'device_connected', { device_id: string; device_name: string }>;
export type DeviceDisconnectedMessage = WsMessage<'device_disconnected', { device_id: string }>;
export type DeviceRegisteredMessage = WsMessage<'device_registered', { device_id: string; device_name: string }>;
export type DeviceHeartbeatMessage = WsMessage<'device_heartbeat', { device_id: string; timestamp: string }>;
export type AgentDiscoveredMessage = WsMessage<'agent_discovered', { device_id: string; agent_slug: string; agent_name: string }>;
export type SessionStartedMessage = WsMessage<'session_started', { session_id: string; device_id: string; agent: string }>;
export type SessionEndedMessage = WsMessage<'session_ended', { session_id: string; status: string }>;
export type ErrorMessage = WsMessage<'error', { code: string; message: string }>;

export type AgentEventMessage = WsMessage<'agent_event', {
  session_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  sequence_number: number;
  idempotency_key: string;
}>;

// ── Enums ───────────────────────────────────────────────────────────────────

export type DeviceStatus = 'PENDING' | 'PAIRED' | 'ACTIVE' | 'REVOKED';
export type SessionStatus = 'INITIALIZING' | 'ACTIVE' | 'COMPLETED' | 'ERROR';
export type ApprovalStatus = 'PENDING' | 'APPROVE' | 'DENY' | 'EXPIRED' | 'CANCELLED';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ActorType = 'USER' | 'DEVICE' | 'SYSTEM';

// ── API Response Types ──────────────────────────────────────────────────────

export interface UserResponse {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
}

export interface DeviceResponse {
  id: string;
  name: string;
  hostname: string | null;
  status: DeviceStatus;
  last_seen_at: string | null;
  paired_at: string | null;
  created_at: string;
}

export interface ApprovalRequestResponse {
  id: string;
  session_id: string | null;
  device_id: string;
  project_id: string | null;
  request_type: string;
  action_summary: string;
  details: Record<string, unknown>;
  working_directory: string | null;
  reason: string | null;
  risk_level: RiskLevel | null;
  status: ApprovalStatus;
  expires_at: string;
  created_at: string;
  decision: ApprovalDecisionResponse | null;
}

export interface ApprovalDecisionResponse {
  id: string;
  request_id: string;
  user_id: string;
  decision: string;
  reason: string | null;
  decided_at: string;
  delivered_at: string | null;
}

export interface AgentSessionResponse {
  id: string;
  device_id: string;
  project_id: string | null;
  provider_slug: string;
  external_session_id: string | null;
  status: SessionStatus;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface AgentEventResponse {
  id: string;
  session_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  sequence_number: number;
  idempotency_key: string;
  created_at: string;
}
