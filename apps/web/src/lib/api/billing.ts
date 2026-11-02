import { api } from './client';

export interface PlanInfo {
  id: string;
  slug: string;
  display_name: string;
  tier: string;
  description: string | null;
  entitlements: Record<string, unknown>;
  price_monthly_cents: number;
  sort_order: number;
}

export interface SubscriptionInfo {
  id: string;
  org_id: string;
  plan_id: string;
  status: string;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface UsageSummaryItem {
  metric: string;
  current: number;
  limit: number;
  within_limit: boolean;
}

export async function fetchPlans(): Promise<PlanInfo[]> {
  return api<PlanInfo[]>('/api/v1/billing/plans');
}

export async function fetchSubscription(orgId: string): Promise<{
  subscription: SubscriptionInfo | null;
  entitlements: Record<string, unknown>;
}> {
  return api(`/api/v1/billing/subscription?org_id=${orgId}`);
}

export async function subscribe(orgId: string, planSlug: string): Promise<{ message: string; status: string }> {
  return api('/api/v1/billing/subscribe', {
    method: 'POST',
    body: JSON.stringify({ org_id: orgId, plan_slug: planSlug }),
  });
}

export async function cancelSubscription(orgId: string): Promise<{ message: string }> {
  return api(`/api/v1/billing/cancel?org_id=${orgId}`, { method: 'POST' });
}

export async function fetchUsage(orgId: string): Promise<UsageSummaryItem[]> {
  return api<UsageSummaryItem[]>(`/api/v1/billing/usage?org_id=${orgId}`);
}
