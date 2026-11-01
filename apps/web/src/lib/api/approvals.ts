import { api } from './client';
import type { ApprovalRequest } from '@/lib/types/api';

export async function fetchApprovals(status?: string): Promise<ApprovalRequest[]> {
  const query = status ? `?status=${status}` : '';
  return api<ApprovalRequest[]>(`/api/v1/approvals${query}`);
}

export async function fetchApproval(id: string): Promise<ApprovalRequest> {
  return api<ApprovalRequest>(`/api/v1/approvals/${id}`);
}

export async function decideApproval(
  id: string,
  decision: 'APPROVE' | 'DENY',
  reason?: string,
): Promise<{ message: string; delivered: boolean }> {
  return api<{ message: string; delivered: boolean }>(
    `/api/v1/approvals/${id}/decide`,
    {
      method: 'POST',
      body: JSON.stringify({ decision, reason: reason ?? null }),
    },
  );
}
