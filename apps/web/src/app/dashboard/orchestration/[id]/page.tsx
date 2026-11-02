'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { Play, Pause, XCircle, RefreshCw, CheckCircle, Clock, AlertTriangle, GitBranch } from 'lucide-react';
import { fetchRunGraph, startRun, updateRun, retryTask } from '@/lib/api/orchestration';
import { cn } from '@/lib/utils/cn';
import { timeAgo, statusColor } from '@/lib/utils/format';
import type { OrchestrationTask } from '@/lib/types/api';

const TASK_STATUS_ICONS: Record<string, { Icon: typeof Clock; color: string }> = {
  CREATED: { Icon: Clock, color: 'text-text-muted' },
  BLOCKED: { Icon: AlertTriangle, color: 'text-status-warning' },
  READY: { Icon: Play, color: 'text-accent' },
  ASSIGNED: { Icon: GitBranch, color: 'text-accent' },
  RUNNING: { Icon: RefreshCw, color: 'text-status-info' },
  VALIDATING: { Icon: CheckCircle, color: 'text-status-warning' },
  COMPLETED: { Icon: CheckCircle, color: 'text-status-success' },
  FAILED: { Icon: XCircle, color: 'text-status-error' },
  CANCELLED: { Icon: XCircle, color: 'text-text-muted' },
};

export default function RunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const { data: graph } = useQuery({
    queryKey: ['orchestration-graph', id],
    queryFn: () => fetchRunGraph(id),
    refetchInterval: 3_000,
  });

  const startMutation = useMutation({
    mutationFn: () => startRun(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['orchestration-graph', id] }),
  });

  const pauseMutation = useMutation({
    mutationFn: () => updateRun(id, { status: 'PAUSED' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['orchestration-graph', id] }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => updateRun(id, { status: 'CANCELLED' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['orchestration-graph', id] }),
  });

  const retryMutation = useMutation({
    mutationFn: (taskId: string) => retryTask(taskId),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['orchestration-graph', id] }),
  });

  if (!graph) {
    return <div className="animate-pulse h-64 bg-surface-raised rounded-lg" />;
  }

  const { run, tasks, dependencies } = graph;
  const completed = tasks.filter((t) => t.status === 'COMPLETED').length;
  const failed = tasks.filter((t) => t.status === 'FAILED').length;
  const running = tasks.filter((t) => t.status === 'RUNNING').length;

  // Build dependency lookup
  const taskDeps = new Map<string, string[]>();
  for (const dep of dependencies) {
    const existing = taskDeps.get(dep.dependent_task_id) ?? [];
    existing.push(dep.source_task_id);
    taskDeps.set(dep.dependent_task_id, existing);
  }

  return (
    <div className="space-y-4">
      <button onClick={() => router.back()} className="text-xs text-text-muted hover:text-text-secondary">
        &larr; Back
      </button>

      {/* Run header */}
      <div className="rounded-lg border border-border-subtle bg-surface-raised p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-base font-semibold">{run.objective}</h1>
            {run.description && <p className="text-xs text-text-muted mt-1">{run.description}</p>}
          </div>
          <span className={cn('text-xs font-medium', statusColor(run.status))}>{run.status}</span>
        </div>

        {/* Progress bar */}
        {tasks.length > 0 && (
          <div className="space-y-1">
            <div className="flex h-2 rounded-full overflow-hidden bg-surface-subtle">
              {completed > 0 && <div className="bg-status-success" style={{ width: `${(completed / tasks.length) * 100}%` }} />}
              {running > 0 && <div className="bg-status-info" style={{ width: `${(running / tasks.length) * 100}%` }} />}
              {failed > 0 && <div className="bg-status-error" style={{ width: `${(failed / tasks.length) * 100}%` }} />}
            </div>
            <div className="flex gap-3 text-[10px] text-text-muted">
              <span>{completed}/{tasks.length} completed</span>
              {running > 0 && <span className="text-status-info">{running} running</span>}
              {failed > 0 && <span className="text-status-error">{failed} failed</span>}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          {run.status === 'CREATED' && (
            <button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="rounded-md bg-status-success/10 border border-status-success/30 px-3 py-1.5 text-xs font-medium text-status-success hover:bg-status-success/20 min-h-[36px]"
            >
              {startMutation.isPending ? 'Starting...' : 'Start Run'}
            </button>
          )}
          {run.status === 'RUNNING' && (
            <button
              onClick={() => pauseMutation.mutate()}
              className="rounded-md bg-surface-subtle border border-border px-3 py-1.5 text-xs font-medium text-text-muted min-h-[36px]"
            >
              Pause
            </button>
          )}
          {run.status === 'PAUSED' && (
            <button
              onClick={() => startMutation.mutate()}
              className="rounded-md bg-accent/10 border border-accent/30 px-3 py-1.5 text-xs font-medium text-accent min-h-[36px]"
            >
              Resume
            </button>
          )}
          {['CREATED', 'RUNNING', 'PAUSED'].includes(run.status) && (
            <button
              onClick={() => cancelMutation.mutate()}
              className="rounded-md bg-surface-subtle border border-border px-3 py-1.5 text-xs font-medium text-status-error min-h-[36px]"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Task list */}
      <div>
        <h2 className="text-sm font-semibold text-text-secondary mb-2">Tasks ({tasks.length})</h2>
        {tasks.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-4">No tasks defined</p>
        ) : (
          <div className="space-y-1.5">
            {tasks.map((task) => {
              const meta = TASK_STATUS_ICONS[task.status] ?? TASK_STATUS_ICONS['CREATED']!;
              const deps = taskDeps.get(task.id) ?? [];
              const depTasks = deps.map((d) => tasks.find((t) => t.id === d)).filter(Boolean) as OrchestrationTask[];

              return (
                <div
                  key={task.id}
                  className="rounded-md border border-border-subtle bg-surface-raised p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <meta.Icon size={14} className={cn('mt-0.5 shrink-0', meta.color)} />
                      <div>
                        <p className="text-sm font-medium">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-muted">
                          <span>{task.task_type}</span>
                          {task.assigned_provider && (
                            <>
                              <span>&middot;</span>
                              <span>{task.assigned_provider}</span>
                            </>
                          )}
                          {task.started_at && (
                            <>
                              <span>&middot;</span>
                              <span>{timeAgo(task.started_at)}</span>
                            </>
                          )}
                        </div>
                        {depTasks.length > 0 && (
                          <p className="text-[10px] text-text-muted mt-0.5">
                            Depends on: {depTasks.map((d) => d.title).join(', ')}
                          </p>
                        )}
                        {task.failure_reason && (
                          <p className="text-[10px] text-status-error mt-0.5">{task.failure_reason}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={cn('text-[10px] font-medium', meta.color)}>{task.status}</span>
                      {task.status === 'FAILED' && task.retry_count < task.max_retries && (
                        <button
                          onClick={() => retryMutation.mutate(task.id)}
                          className="rounded bg-surface-subtle border border-border px-1.5 py-0.5 text-[10px] text-text-muted hover:text-text-primary"
                        >
                          Retry
                        </button>
                      )}
                    </div>
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
