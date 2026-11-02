import { api } from './client';
import type {
  WorkflowSummary,
  WorkflowVersionSummary,
  WorkflowInstallationSummary,
  OrchestrationRun,
} from '@/lib/types/api';

export async function fetchWorkflows(params?: { category?: string; q?: string }): Promise<WorkflowSummary[]> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set('category', params.category);
  if (params?.q) searchParams.set('q', params.q);
  const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
  return api<WorkflowSummary[]>(`/api/v1/workflows${query}`);
}

export async function fetchWorkflow(id: string): Promise<WorkflowSummary> {
  return api<WorkflowSummary>(`/api/v1/workflows/${id}`);
}

export async function createWorkflow(body: {
  name: string;
  display_name: string;
  description?: string;
  category?: string;
  tags?: string[];
  visibility?: string;
}): Promise<WorkflowSummary> {
  return api<WorkflowSummary>('/api/v1/workflows', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchVersions(workflowId: string): Promise<WorkflowVersionSummary[]> {
  return api<WorkflowVersionSummary[]>(`/api/v1/workflows/${workflowId}/versions`);
}

export async function createVersion(workflowId: string, body: {
  version_number: string;
  definition: { tasks: unknown[]; dependencies: unknown[]; constraints?: Record<string, unknown> };
  changelog?: string;
}): Promise<WorkflowVersionSummary> {
  return api<WorkflowVersionSummary>(`/api/v1/workflows/${workflowId}/versions`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchInstallations(): Promise<WorkflowInstallationSummary[]> {
  return api<WorkflowInstallationSummary[]>('/api/v1/workflows/installations');
}

export async function installWorkflow(body: {
  workflow_id: string;
  workflow_version_id: string;
  project_id?: string;
}): Promise<WorkflowInstallationSummary> {
  return api<WorkflowInstallationSummary>('/api/v1/workflows/installations', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function executeInstallation(installationId: string): Promise<OrchestrationRun> {
  return api<OrchestrationRun>(`/api/v1/workflows/installations/${installationId}/execute`, {
    method: 'POST',
  });
}
