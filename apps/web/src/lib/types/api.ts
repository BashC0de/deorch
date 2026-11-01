export interface User {
  id: string;
  email: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface Device {
  id: string;
  name: string;
  hostname: string | null;
  status: 'PENDING' | 'PAIRED' | 'ACTIVE' | 'REVOKED';
  last_seen_at: string | null;
  paired_at: string | null;
  created_at: string;
}

export interface ApprovalRequest {
  id: string;
  session_id: string | null;
  device_id: string;
  project_id: string | null;
  request_type: string;
  hook_event_name: string | null;
  tool_name: string | null;
  action_category: string | null;
  action_summary: string;
  details: Record<string, unknown>;
  working_directory: string | null;
  reason: string | null;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'EXPIRED' | 'CANCELLED' | 'FAILED';
  expires_at: string;
  created_at: string;
  decision: ApprovalDecision | null;
}

export interface ApprovalDecision {
  id: string;
  request_id: string;
  user_id: string;
  decision: string;
  reason: string | null;
  decided_at: string;
  delivered_at: string | null;
}

export interface AgentSession {
  id: string;
  device_id: string;
  project_id: string | null;
  provider_slug: string;
  external_session_id: string | null;
  status: 'INITIALIZING' | 'ACTIVE' | 'COMPLETED' | 'ERROR';
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
}

export interface AgentEvent {
  id: string;
  session_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  sequence_number: number;
  idempotency_key: string;
  created_at: string;
}

// ── Development Intelligence ──────────────────────────────────────────────

export interface ServiceRegistration {
  id: string;
  name: string;
  service_type: string;
  project_id: string | null;
  device_id: string;
  host: string;
  port: number;
  health_path: string | null;
  expected_status: number;
  interval_seconds: number;
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'STOPPED' | 'UNKNOWN';
  is_active: boolean;
  created_at: string;
}

export interface ServiceHealthCheck {
  id: string;
  service_id: string;
  status: string;
  response_ms: number | null;
  status_code: number | null;
  error: string | null;
  checked_at: string;
}

export interface TestRun {
  id: string;
  project_id: string | null;
  device_id: string;
  session_id: string | null;
  framework: string;
  total_tests: number;
  passed: number;
  failed: number;
  skipped: number;
  duration_ms: number | null;
  status: string;
  failures: Array<{ name: string; message: string }>;
  error_output: string | null;
  created_at: string;
}

export interface GitSnapshot {
  id: string;
  project_id: string | null;
  device_id: string;
  branch: string;
  commit_hash: string;
  modified_files: string[];
  added_files: string[];
  deleted_files: string[];
  untracked_files: string[];
  diff_stats: { additions?: number; deletions?: number };
  created_at: string;
}

export interface BuildResult {
  id: string;
  project_id: string | null;
  device_id: string;
  session_id: string | null;
  build_type: string;
  command: string;
  exit_code: number | null;
  status: string;
  error_output: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface ProjectHealth {
  project_id: string;
  project_name: string;
  services: ServiceRegistration[];
  latest_test_run: TestRun | null;
  latest_build: BuildResult | null;
  latest_git: GitSnapshot | null;
}

// ── Audit ─────────────────────────────────────────────────────────────────

export interface AuditRecord {
  id: string;
  event_type: string;
  actor_type: string;
  device_id: string | null;
  session_id: string | null;
  request_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}
