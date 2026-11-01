export interface WsMessage {
  type: string;
  id: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

export type WsMessageType =
  | 'auth_required'
  | 'auth_ok'
  | 'auth_error'
  | 'ping'
  | 'pong'
  | 'approval_request'
  | 'approval_decision'
  | 'device_connected'
  | 'device_disconnected'
  | 'device_registered'
  | 'session_started'
  | 'session_ended'
  | 'agent_event'
  | 'error';
