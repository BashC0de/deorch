'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Monitor, Terminal, Shield, AlertTriangle } from 'lucide-react';
import { fetchApprovals } from '@/lib/api/approvals';
import { fetchDevices } from '@/lib/api/devices';
import { fetchSessions } from '@/lib/api/sessions';
import { cn } from '@/lib/utils/cn';
import { timeAgo, riskColor, statusColor } from '@/lib/utils/format';
import { useWs } from '@/lib/providers/ws-provider';

export default function DashboardPage() {
  const { isConnected } = useWs();
  const { data: devices = [] } = useQuery({ queryKey: ['devices'], queryFn: fetchDevices });
  const { data: sessions = [] } = useQuery({ queryKey: ['sessions'], queryFn: fetchSessions });
  const { data: approvals = [] } = useQuery({ queryKey: ['approvals'], queryFn: () => fetchApprovals() });

  const onlineDevices = devices.filter((d) => d.status === 'ACTIVE');
  const activeSessions = sessions.filter((s) => s.status === 'ACTIVE');
  const pendingApprovals = approvals.filter((a) => a.status === 'PENDING');
  const failedSessions = sessions.filter((s) => s.status === 'ERROR');

  const stats = [
    { label: 'Machines', value: `${onlineDevices.length}/${devices.length}`, Icon: Monitor, highlight: false },
    { label: 'Sessions', value: activeSessions.length, Icon: Terminal, highlight: false },
    { label: 'Pending', value: pendingApprovals.length, Icon: Shield, highlight: pendingApprovals.length > 0 },
    { label: 'Failures', value: failedSessions.length, Icon: AlertTriangle, highlight: failedSessions.length > 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">Overview</h1>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium',
            isConnected ? 'bg-status-success/10 text-status-success' : 'bg-status-error/10 text-status-error',
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', isConnected ? 'bg-status-success' : 'bg-status-error')} />
          {isConnected ? 'Live' : 'Disconnected'}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border-subtle bg-surface-raised p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-1">
              <s.Icon size={14} className="text-text-muted" />
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">{s.label}</p>
            </div>
            <p className={cn('text-xl sm:text-2xl font-bold', s.highlight && 'text-status-warning')}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Pending approvals */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-secondary">Pending Approvals</h2>
          <Link href="/dashboard/approvals" className="text-xs text-accent hover:text-accent-hover">
            View all
          </Link>
        </div>
        {pendingApprovals.length === 0 ? (
          <p className="text-sm text-text-muted rounded-lg border border-border-subtle bg-surface-raised p-4 text-center">
            No pending approvals
          </p>
        ) : (
          <div className="space-y-2">
            {pendingApprovals.slice(0, 5).map((a) => (
              <Link
                key={a.id}
                href={`/dashboard/approvals/${a.id}`}
                className="block rounded-lg border border-border-subtle bg-surface-raised p-3 hover:bg-surface-subtle transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{a.action_summary}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
                      {a.tool_name && <span className="text-text-secondary">{a.tool_name}</span>}
                      <span>{timeAgo(a.created_at)}</span>
                    </div>
                  </div>
                  <span className={cn('text-xs font-medium shrink-0', riskColor(a.risk_level))}>
                    {a.risk_level ?? ''}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Active sessions */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-text-secondary">Active Sessions</h2>
          <Link href="/dashboard/sessions" className="text-xs text-accent hover:text-accent-hover">
            View all
          </Link>
        </div>
        {activeSessions.length === 0 ? (
          <p className="text-sm text-text-muted rounded-lg border border-border-subtle bg-surface-raised p-4 text-center">
            No active sessions
          </p>
        ) : (
          <div className="space-y-2">
            {activeSessions.slice(0, 5).map((s) => (
              <Link
                key={s.id}
                href={`/dashboard/sessions/${s.id}`}
                className="block rounded-lg border border-border-subtle bg-surface-raised p-3 hover:bg-surface-subtle transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-accent shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{s.provider_slug}</p>
                      <p className="text-xs text-text-muted mt-0.5">{timeAgo(s.started_at ?? s.created_at)}</p>
                    </div>
                  </div>
                  <span className={cn('text-xs font-medium', statusColor(s.status))}>{s.status}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
