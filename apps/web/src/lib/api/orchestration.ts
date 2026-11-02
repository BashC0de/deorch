import { api } from './client';
import type { OrchestrationRun, OrchestrationTask, TaskDependency, RunGraph } from '@/lib/types/api';

export async function fetchRuns(status?: string): Promise<OrchestrationRun[]> {
  const query = status ? `?status=${status}` : '';
  return api<OrchestrationRun[]>(`/api/v1/orchestration/runs${query}`);
}

export async function fetchRun(id: string): Promise<OrchestrationRun> {
  return api<OrchestrationRun>(`/api/v1/orchestration/runs/${id}`);
}

export async function createRun(body: {
  objective: string;
  description?: string;
  project_id?: string;
  max_concurrent_tasks?: number;
}): Promise<OrchestrationRun> {
  return api<OrchestrationRun>('/api/v1/orchestration/runs', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateRun(id: string, body: { status?: string }): Promise<OrchestrationRun> {
  return api<OrchestrationRun>(`/api/v1/orchestration/runs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function startRun(id: string): Promise<{ message: string; ready_tasks: number }> {
  return api(`/api/v1/orchestration/runs/${id}/start`, { method: 'POST' });
}

export async function fetchRunTasks(runId: string): Promise<OrchestrationTask[]> {
  return api<OrchestrationTask[]>(`/api/v1/orchestration/runs/${runId}/tasks`);
}

export async function createTask(runId: string, body: {
  title: string;
  description?: string;
  task_type?: string;
  priority?: number;
  assigned_provider?: string;
}): Promise<OrchestrationTask> {
  return api<OrchestrationTask>(`/api/v1/orchestration/runs/${runId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateTask(taskId: string, body: {
  status?: string;
  result?: Record<string, unknown>;
  failure_reason?: string;
}): Promise<OrchestrationTask> {
  return api<OrchestrationTask>(`/api/v1/orchestration/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function retryTask(taskId: string): Promise<{ message: string }> {
  return api(`/api/v1/orchestration/tasks/${taskId}/retry`, { method: 'POST' });
}

export async function fetchRunGraph(runId: string): Promise<RunGraph> {
  return api<RunGraph>(`/api/v1/orchestration/runs/${runId}/graph`);
}

export async function addDependency(runId: string, sourceId: string, dependentId: string): Promise<TaskDependency> {
  return api<TaskDependency>(`/api/v1/orchestration/runs/${runId}/dependencies`, {
    method: 'POST',
    body: JSON.stringify({ source_task_id: sourceId, dependent_task_id: dependentId }),
  });
}
