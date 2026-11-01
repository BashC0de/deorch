'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Terminal } from 'lucide-react';
import { fetchSessions } from '@/lib/api/sessions';
import { cn } from '@/lib/utils/cn';
import { timeAgo, statusColor } from '@/lib/utils/format';

const TABS = ['ALL', 'ACTIVE', 'COMPLETED', 'ERROR'] as const;

export default function SessionsPage() {
  const [tab, setTab] = useState<string>('ALL');
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: fetchSessions,
    refetchInterval: 10000,
  });

  const filtered = tab === 'ALL'
    ? sessions
    : sessions.filter((s) => s.status === tab);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Agent Sessions</h1>

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
            {t.charAt(0) + t.slice(1).toLowerCase()}
            {t !== 'ALL' && (
              <span className="ml-1 text-text-muted">
                ({sessions.filter((s) => s.status === t).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-surface-raised animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">
          {tab === 'ALL' ? 'No agent sessions recorded yet' : `No ${tab.toLowerCase()} sessions`}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/sessions/${s.id}`}
              className="block rounded-lg border border-border-subtle bg-surface-raised p-3 hover:bg-surface-subtle transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Terminal size={14} className={cn(
                    s.status === 'ACTIVE' ? 'text-accent' : 'text-text-muted'
                  )} />
                  <div>
                    <p className="text-sm font-medium">{s.provider_slug}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
                      <span>{timeAgo(s.started_at ?? s.created_at)}</span>
                      {s.ended_at && (
                        <>
                          <span>&middot;</span>
                          <span>ended {timeAgo(s.ended_at)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <span className={cn('text-xs font-medium', statusColor(s.status))}>
                  {s.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
