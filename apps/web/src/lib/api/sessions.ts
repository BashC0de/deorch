import { api } from './client';
import type { AgentEvent, AgentSession } from '@/lib/types/api';

export async function fetchSessions(): Promise<AgentSession[]> {
  return api<AgentSession[]>('/api/v1/sessions');
}

export async function fetchSession(id: string): Promise<AgentSession> {
  return api<AgentSession>(`/api/v1/sessions/${id}`);
}

export async function fetchSessionEvents(sessionId: string): Promise<AgentEvent[]> {
  return api<AgentEvent[]>(`/api/v1/sessions/${sessionId}/events`);
}
