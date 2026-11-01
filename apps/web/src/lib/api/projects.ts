import { api } from './client';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  device_id: string | null;
  path: string | null;
  git_remote: string | null;
  is_active: boolean;
  created_at: string;
}

export async function fetchProjects(): Promise<Project[]> {
  return api<Project[]>('/api/v1/projects');
}

export async function fetchProject(id: string): Promise<Project> {
  return api<Project>(`/api/v1/projects/${id}`);
}
