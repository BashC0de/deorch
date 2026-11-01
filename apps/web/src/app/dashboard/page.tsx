'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
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

  const onlineDevices = devices.filter((d) => d.status === 'ACTIVE' || d.status === 'PAIRED');
  const activeSessions = sessions.filter((s) => s.status === 'ACTIVE');
  const pendingApprovals = approvals.filter((a) => a.status === 'PENDING');

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
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Machines</p>
          <p className="mt-1 text-2xl font-bold">{onlineDevices.length}</p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Sessions</p>
          <p className="mt-1 text-2xl font-bold">{activeSessions.length}</p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
          <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Pending</p>
          <p className={cn('mt-1 text-2xl font-bold', pendingApprovals.length > 0 && 'text-status-warning')}>
            {pendingApprovals.length}
          </p>
        </div>
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
                    <p className="text-xs text-text-muted mt-0.5">{a.request_type} &middot; {timeAgo(a.created_at)}</p>
                  </div>
                  <span className={cn('text-xs font-medium', riskColor(a.risk_level))}>
                    {a.risk_level ?? '—'}
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
                  <div>
                    <p className="text-sm font-medium">{s.provider_slug}</p>
                    <p className="text-xs text-text-muted mt-0.5">{timeAgo(s.started_at ?? s.created_at)}</p>
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
