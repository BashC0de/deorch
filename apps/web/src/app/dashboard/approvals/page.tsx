'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchApprovals } from '@/lib/api/approvals';
import { cn } from '@/lib/utils/cn';
import { timeAgo, riskColor, statusColor } from '@/lib/utils/format';

const TABS = ['ALL', 'PENDING', 'APPROVED', 'DENIED', 'EXPIRED'] as const;

export default function ApprovalsPage() {
  const [tab, setTab] = useState<string>('ALL');
  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ['approvals', tab],
    queryFn: () => fetchApprovals(tab === 'ALL' ? undefined : tab),
    refetchInterval: 5000,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Approvals</h1>

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border-subtle pb-px">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors whitespace-nowrap',
              tab === t
                ? 'bg-surface-subtle text-text-primary border-b-2 border-accent'
                : 'text-text-muted hover:text-text-secondary',
            )}
          >
            {t === 'APPROVED' ? 'Approved' : t === 'DENIED' ? 'Denied' : t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-surface-raised animate-pulse" />
          ))}
        </div>
      ) : approvals.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">No approval requests</p>
      ) : (
        <div className="space-y-2">
          {approvals.map((a) => (
            <Link
              key={a.id}
              href={`/dashboard/approvals/${a.id}`}
              className="block rounded-lg border border-border-subtle bg-surface-raised p-3 hover:bg-surface-subtle transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{a.action_summary}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                    <span>{a.request_type}</span>
                    <span>&middot;</span>
                    <span>{timeAgo(a.created_at)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={cn('text-xs font-medium', statusColor(a.status))}>
                    {a.status}
                  </span>
                  {a.risk_level && (
                    <span className={cn('text-[10px] font-medium', riskColor(a.risk_level))}>
                      {a.risk_level}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
