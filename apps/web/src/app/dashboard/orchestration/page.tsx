'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { GitBranch, Play, CheckCircle, XCircle, Pause, Clock } from 'lucide-react';
import { fetchRuns } from '@/lib/api/orchestration';
import { cn } from '@/lib/utils/cn';
import { timeAgo, statusColor } from '@/lib/utils/format';

const TABS = ['ALL', 'RUNNING', 'COMPLETED', 'FAILED'] as const;

const STATUS_ICONS: Record<string, typeof Play> = {
  CREATED: Clock,
  RUNNING: Play,
  PAUSED: Pause,
  COMPLETED: CheckCircle,
  FAILED: XCircle,
};

export default function OrchestrationPage() {
  const [tab, setTab] = useState<string>('ALL');
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ['orchestration-runs', tab],
    queryFn: () => fetchRuns(tab === 'ALL' ? undefined : tab),
    refetchInterval: 5_000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Orchestration</h1>
        <Link
          href="/dashboard/orchestration/new"
          className="rounded-md bg-accent-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-primary/90 transition-colors min-h-[36px] flex items-center"
        >
          New Run
        </Link>
      </div>

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
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-surface-raised animate-pulse" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">No orchestration runs yet</p>
      ) : (
        <div className="space-y-2">
          {runs.map((run) => {
            const Icon = STATUS_ICONS[run.status] ?? Clock;
            return (
              <Link
                key={run.id}
                href={`/dashboard/orchestration/${run.id}`}
                className="block rounded-lg border border-border-subtle bg-surface-raised p-4 hover:bg-surface-subtle transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <Icon size={16} className={cn('mt-0.5 shrink-0', statusColor(run.status))} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium line-clamp-2">{run.objective}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-text-muted">
                        <span>{run.task_count} tasks</span>
                        <span>&middot;</span>
                        <span>{timeAgo(run.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <span className={cn('text-xs font-medium shrink-0', statusColor(run.status))}>
                    {run.status}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
