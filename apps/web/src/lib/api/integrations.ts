import { api } from './client';

export interface IntegrationInfo {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  provider: string;
  auth_type: string;
  capabilities: string[];
  required_permissions: string[];
  is_available: boolean;
  trust_status: string;
  created_at: string;
}

export interface ConnectionInfo {
  id: string;
  integration_id: string;
  org_id: string;
  config: Record<string, unknown>;
  status: string;
  connected_at: string;
  created_at: string;
  integration: IntegrationInfo | null;
}

export async function fetchIntegrations(category?: string): Promise<IntegrationInfo[]> {
  const query = category ? `?category=${category}` : '';
  return api<IntegrationInfo[]>(`/api/v1/integrations${query}`);
}

export async function fetchConnections(orgId: string): Promise<ConnectionInfo[]> {
  return api<ConnectionInfo[]>(`/api/v1/integrations/connections?org_id=${orgId}`);
}

export async function connectIntegration(body: {
  integration_slug: string;
  org_id: string;
  credentials?: string;
  config?: Record<string, unknown>;
}): Promise<ConnectionInfo> {
  return api<ConnectionInfo>('/api/v1/integrations/connect', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function disconnectIntegration(connectionId: string): Promise<{ message: string }> {
  return api(`/api/v1/integrations/connections/${connectionId}`, { method: 'DELETE' });
}
