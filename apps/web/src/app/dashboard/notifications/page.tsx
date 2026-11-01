'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Shield, Monitor, Terminal, AlertTriangle, Bell } from 'lucide-react';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import { timeAgo } from '@/lib/utils/format';
import { isRead, markAsRead } from '@/lib/notifications';
import { useState, useEffect } from 'react';
import type { AuditRecord } from '@/lib/types/api';
import { subscribeToPush, unsubscribeFromPush, isPushSubscribed } from '@/lib/push';

const NOTIFICATION_EVENT_TYPES = [
  'approval_request.created',
  'approval_decision.approved',
  'approval_decision.denied',
  'approval_request.expired',
  'approval_request.cancelled',
  'device.registered',
  'device.revoked',
];

const EVENT_META: Record<string, { Icon: typeof Bell; label: string; color: string; link?: (r: AuditRecord) => string }> = {
  'approval_request.created': { Icon: Shield, label: 'Approval requested', color: 'text-status-warning', link: (r) => r.request_id ? `/dashboard/approvals/${r.request_id}` : '' },
  'approval_decision.approved': { Icon: Shield, label: 'Approval granted', color: 'text-status-success', link: (r) => r.request_id ? `/dashboard/approvals/${r.request_id}` : '' },
  'approval_decision.denied': { Icon: Shield, label: 'Approval denied', color: 'text-status-error', link: (r) => r.request_id ? `/dashboard/approvals/${r.request_id}` : '' },
  'approval_request.expired': { Icon: AlertTriangle, label: 'Request expired', color: 'text-text-muted' },
  'approval_request.cancelled': { Icon: AlertTriangle, label: 'Request cancelled', color: 'text-text-muted' },
  'device.registered': { Icon: Monitor, label: 'Device registered', color: 'text-accent', link: (r) => r.device_id ? `/dashboard/devices/${r.device_id}` : '' },
  'device.revoked': { Icon: Monitor, label: 'Device revoked', color: 'text-status-error' },
};

export default function NotificationsPage() {
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    void isPushSubscribed().then(setPushEnabled);
  }, []);

  const { data: records = [] } = useQuery({
    queryKey: ['audit', 'notifications'],
    queryFn: () =>
      api<AuditRecord[]>(`/api/v1/audit?limit=50&event_type=${NOTIFICATION_EVENT_TYPES[0]}`).catch(() => [] as AuditRecord[]),
    refetchInterval: 15_000,
  });

  // We fetch multiple event types separately and merge — simplified: just fetch recent audit
  const { data: allRecords = [] } = useQuery({
    queryKey: ['audit', 'all-notifications'],
    queryFn: async () => {
      const results = await Promise.allSettled(
        NOTIFICATION_EVENT_TYPES.map((type) =>
          api<AuditRecord[]>(`/api/v1/audit?limit=10&event_type=${type}`)
        )
      );
      const merged: AuditRecord[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled') merged.push(...r.value);
      }
      return merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
    refetchInterval: 15_000,
  });

  async function togglePush() {
    if (pushEnabled) {
      await unsubscribeFromPush();
      setPushEnabled(false);
    } else {
      const ok = await subscribeToPush();
      setPushEnabled(ok);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Activity</h1>
        <button
          onClick={togglePush}
          className={cn(
            'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors min-h-[36px]',
            pushEnabled
              ? 'border-status-success/30 bg-status-success/10 text-status-success'
              : 'border-border bg-surface-subtle text-text-muted hover:text-text-primary',
          )}
        >
          {pushEnabled ? 'Push: On' : 'Enable Push'}
        </button>
      </div>

      {allRecords.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">No recent activity</p>
      ) : (
        <div className="space-y-1.5">
          {allRecords.map((r) => {
            const meta = EVENT_META[r.event_type] ?? { Icon: Bell, label: r.event_type, color: 'text-text-muted' };
            const read = isRead(r.id);
            const link = meta.link?.(r);

            const content = (
              <div
                className={cn(
                  'rounded-lg border border-border-subtle bg-surface-raised p-3 transition-colors',
                  !read && 'border-l-2 border-l-accent',
                  link && 'hover:bg-surface-subtle cursor-pointer',
                )}
                onClick={() => markAsRead(r.id)}
              >
                <div className="flex items-start gap-3">
                  <meta.Icon size={16} className={cn('mt-0.5 shrink-0', meta.color)} />
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium', read ? 'text-text-secondary' : 'text-text-primary')}>
                      {meta.label}
                    </p>
                    {r.payload && typeof r.payload === 'object' && 'action_summary' in r.payload && (
                      <p className="text-xs text-text-muted mt-0.5 truncate">
                        {String(r.payload['action_summary'])}
                      </p>
                    )}
                    <p className="text-[10px] text-text-muted mt-1">{timeAgo(r.created_at)}</p>
                  </div>
                </div>
              </div>
            );

            return link ? (
              <Link key={r.id} href={link}>{content}</Link>
            ) : (
              <div key={r.id}>{content}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
