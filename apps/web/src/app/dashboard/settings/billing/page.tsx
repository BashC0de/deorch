'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { CreditCard, CheckCircle, AlertTriangle } from 'lucide-react';
import { fetchPlans, fetchUsage, type PlanInfo, type UsageSummaryItem } from '@/lib/api/billing';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

interface OrgInfo { id: string; name: string; display_name: string }

export default function BillingPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: orgs = [] } = useQuery({
    queryKey: ['orgs'],
    queryFn: () => api<OrgInfo[]>('/api/v1/workflows/orgs'),
  });

  const orgId = orgs[0]?.id;

  const { data: plans = [] } = useQuery({
    queryKey: ['plans'],
    queryFn: fetchPlans,
  });

  const { data: subData } = useQuery({
    queryKey: ['subscription', orgId],
    queryFn: () => orgId ? api<{ subscription: any; entitlements: Record<string, unknown> }>(`/api/v1/billing/subscription?org_id=${orgId}`) : Promise.resolve({ subscription: null, entitlements: {} }),
    enabled: !!orgId,
  });

  const { data: usage = [] } = useQuery({
    queryKey: ['usage', orgId],
    queryFn: () => orgId ? fetchUsage(orgId) : Promise.resolve([]),
    enabled: !!orgId,
  });

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="text-xs text-text-muted hover:text-text-secondary">
        &larr; Back
      </button>

      <h1 className="text-lg font-semibold">Billing & Plan</h1>

      {!orgId ? (
        <p className="text-sm text-text-muted rounded-lg border border-border-subtle bg-surface-raised p-4 text-center">
          Create an organization first to manage billing.
        </p>
      ) : (
        <>
          {/* Current subscription */}
          <section className="rounded-lg border border-border-subtle bg-surface-raised p-4">
            <h2 className="text-sm font-semibold text-text-secondary mb-3">Current Plan</h2>
            {subData?.subscription ? (
              <div className="flex items-center gap-3">
                <CreditCard size={16} className="text-accent" />
                <div>
                  <p className="text-sm font-medium">{subData.subscription.status}</p>
                  {subData.subscription.trial_ends_at && (
                    <p className="text-xs text-text-muted">
                      Trial ends: {new Date(subData.subscription.trial_ends_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-muted">No active subscription</p>
            )}
          </section>

          {/* Usage */}
          <section className="rounded-lg border border-border-subtle bg-surface-raised p-4">
            <h2 className="text-sm font-semibold text-text-secondary mb-3">Usage This Period</h2>
            {usage.length === 0 ? (
              <p className="text-xs text-text-muted">No usage recorded</p>
            ) : (
              <div className="space-y-2">
                {usage.map((u) => (
                  <div key={u.metric} className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary capitalize">{u.metric.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'font-medium',
                        !u.within_limit ? 'text-status-error' : 'text-text-primary'
                      )}>
                        {u.current}
                      </span>
                      <span className="text-text-muted">/ {u.limit === -1 ? 'unlimited' : u.limit}</span>
                      {!u.within_limit && <AlertTriangle size={12} className="text-status-error" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Available plans */}
          <section>
            <h2 className="text-sm font-semibold text-text-secondary mb-3">Available Plans</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {plans.map((plan) => (
                <div key={plan.id} className="rounded-lg border border-border-subtle bg-surface-raised p-4">
                  <p className="text-sm font-semibold">{plan.display_name}</p>
                  <p className="text-xs text-text-muted mt-0.5">{plan.description}</p>
                  <p className="text-lg font-bold mt-2">
                    {plan.price_monthly_cents === 0 ? 'Free' : `$${(plan.price_monthly_cents / 100).toFixed(0)}/mo`}
                  </p>
                  <div className="mt-2 space-y-1 text-[10px] text-text-muted">
                    {Object.entries(plan.entitlements).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-1">
                        <CheckCircle size={8} className="text-status-success" />
                        <span>{key.replace(/^max_/, '').replace(/_/g, ' ')}: {val === -1 ? 'unlimited' : val === true ? 'yes' : val === false ? 'no' : String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
