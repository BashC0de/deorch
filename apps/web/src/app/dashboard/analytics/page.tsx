'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3, Users, Monitor, Terminal, Shield, Layers } from 'lucide-react';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

interface Metrics {
  period_days: number;
  event_counts: Record<string, number>;
  active_days: number;
  total_events: number;
  devices_paired: number;
  sessions_started: number;
  approvals_handled: number;
  workflows_executed: number;
}

export default function AnalyticsPage() {
  const { data: metrics } = useQuery({
    queryKey: ['analytics-metrics'],
    queryFn: () => api<Metrics>('/api/v1/analytics/metrics?days=30'),
    refetchInterval: 60_000,
  });

  if (!metrics) {
    return <div className="animate-pulse h-64 bg-surface-raised rounded-lg" />;
  }

  const statCards = [
    { label: 'Total Events', value: metrics.total_events, Icon: BarChart3, color: 'text-accent' },
    { label: 'Active Days', value: metrics.active_days, Icon: Users, color: 'text-status-success' },
    { label: 'Devices Paired', value: metrics.devices_paired, Icon: Monitor, color: 'text-status-info' },
    { label: 'Sessions', value: metrics.sessions_started, Icon: Terminal, color: 'text-accent' },
    { label: 'Approvals', value: metrics.approvals_handled, Icon: Shield, color: 'text-status-warning' },
    { label: 'Workflows', value: metrics.workflows_executed, Icon: Layers, color: 'text-status-success' },
  ];

  const eventEntries = Object.entries(metrics.event_counts).sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Analytics</h1>
        <span className="text-xs text-text-muted">Last {metrics.period_days} days</span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-lg border border-border-subtle bg-surface-raised p-3">
            <div className="flex items-center gap-2 mb-1">
              <s.Icon size={14} className={s.color} />
              <p className="text-xs text-text-muted">{s.label}</p>
            </div>
            <p className="text-xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Event breakdown */}
      <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
        <h2 className="text-sm font-semibold text-text-secondary mb-3">Event Breakdown</h2>
        {eventEntries.length === 0 ? (
          <p className="text-xs text-text-muted text-center py-4">No events recorded yet</p>
        ) : (
          <div className="space-y-2">
            {eventEntries.map(([name, count]) => {
              const maxCount = eventEntries[0]?.[1] ?? 1;
              const pct = Math.round((count / maxCount) * 100);
              return (
                <div key={name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary font-medium">{name}</span>
                    <span className="text-text-muted">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-subtle overflow-hidden">
                    <div className="h-full bg-accent/60 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
