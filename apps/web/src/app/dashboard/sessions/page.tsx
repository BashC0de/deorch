'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchSessions } from '@/lib/api/sessions';
import { cn } from '@/lib/utils/cn';
import { timeAgo, statusColor } from '@/lib/utils/format';

export default function SessionsPage() {
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: fetchSessions,
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Agent Sessions</h1>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-surface-raised animate-pulse" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">No agent sessions recorded yet</p>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <Link
              key={s.id}
              href={`/dashboard/sessions/${s.id}`}
              className="block rounded-lg border border-border-subtle bg-surface-raised p-3 hover:bg-surface-subtle transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{s.provider_slug}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                    <span>{timeAgo(s.started_at ?? s.created_at)}</span>
                    {s.ended_at && (
                      <>
                        <span>&middot;</span>
                        <span>ended {timeAgo(s.ended_at)}</span>
                      </>
                    )}
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
