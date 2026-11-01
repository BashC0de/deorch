import { api } from './client';
import type {
  ServiceRegistration,
  ServiceHealthCheck,
  TestRun,
  GitSnapshot,
  BuildResult,
  ProjectHealth,
} from '@/lib/types/api';

// Services
export async function fetchServices(): Promise<ServiceRegistration[]> {
  return api<ServiceRegistration[]>('/api/v1/services');
}

export async function fetchServiceHealth(serviceId: string, limit = 20): Promise<ServiceHealthCheck[]> {
  return api<ServiceHealthCheck[]>(`/api/v1/services/${serviceId}/health?limit=${limit}`);
}

// Test Runs
export async function fetchTestRuns(projectId?: string, limit = 20): Promise<TestRun[]> {
  const params = new URLSearchParams();
  if (projectId) params.set('project_id', projectId);
  params.set('limit', String(limit));
  return api<TestRun[]>(`/api/v1/test-runs?${params.toString()}`);
}

export async function fetchTestRun(id: string): Promise<TestRun> {
  return api<TestRun>(`/api/v1/test-runs/${id}`);
}

// Git Snapshots
export async function fetchGitSnapshots(projectId?: string, limit = 10): Promise<GitSnapshot[]> {
  const params = new URLSearchParams();
  if (projectId) params.set('project_id', projectId);
  params.set('limit', String(limit));
  return api<GitSnapshot[]>(`/api/v1/git-snapshots?${params.toString()}`);
}

// Build Results
export async function fetchBuildResults(projectId?: string, limit = 20): Promise<BuildResult[]> {
  const params = new URLSearchParams();
  if (projectId) params.set('project_id', projectId);
  params.set('limit', String(limit));
  return api<BuildResult[]>(`/api/v1/build-results?${params.toString()}`);
}

// Project Health
export async function fetchProjectHealth(projectId: string): Promise<ProjectHealth> {
  return api<ProjectHealth>(`/api/v1/projects/${projectId}/health`);
}
