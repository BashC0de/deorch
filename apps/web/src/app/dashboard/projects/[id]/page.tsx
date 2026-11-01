'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { Server, CheckCircle, XCircle, GitBranch, Hammer, FileText } from 'lucide-react';
import { fetchProjectHealth } from '@/lib/api/intelligence';
import { cn } from '@/lib/utils/cn';
import { timeAgo } from '@/lib/utils/format';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: health } = useQuery({
    queryKey: ['project-health', id],
    queryFn: () => fetchProjectHealth(id),
    refetchInterval: 15_000,
  });

  if (!health) {
    return <div className="animate-pulse h-64 bg-surface-raised rounded-lg" />;
  }

  const totalChanged = health.latest_git
    ? health.latest_git.modified_files.length + health.latest_git.added_files.length + health.latest_git.deleted_files.length
    : 0;

  return (
    <div className="space-y-4">
      <button onClick={() => router.back()} className="text-xs text-text-muted hover:text-text-secondary">
        &larr; Back
      </button>

      <h1 className="text-lg font-semibold">{health.project_name}</h1>

      {/* Services Health */}
      <section className="rounded-lg border border-border-subtle bg-surface-raised p-4">
        <h2 className="text-sm font-semibold text-text-secondary flex items-center gap-2 mb-3">
          <Server size={14} /> Services
        </h2>
        {health.services.length === 0 ? (
          <p className="text-xs text-text-muted">No services configured</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {health.services.map((svc) => (
              <div key={svc.id} className="flex items-center gap-2.5 rounded-md bg-surface-subtle p-2.5">
                <span className={cn(
                  'h-2.5 w-2.5 rounded-full shrink-0',
                  svc.status === 'HEALTHY' ? 'bg-status-success' :
                  svc.status === 'DEGRADED' ? 'bg-status-warning' :
                  svc.status === 'UNHEALTHY' || svc.status === 'STOPPED' ? 'bg-status-error' :
                  'bg-text-muted',
                )} />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{svc.name}</p>
                  <p className="text-[10px] text-text-muted">{svc.host}:{svc.port} &middot; {svc.status}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Test Results */}
      <section className="rounded-lg border border-border-subtle bg-surface-raised p-4">
        <h2 className="text-sm font-semibold text-text-secondary flex items-center gap-2 mb-3">
          <CheckCircle size={14} /> Tests
        </h2>
        {health.latest_test_run ? (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={cn(
                'text-xs font-medium px-2 py-0.5 rounded',
                health.latest_test_run.failed > 0
                  ? 'bg-status-error/10 text-status-error'
                  : 'bg-status-success/10 text-status-success',
              )}>
                {health.latest_test_run.failed > 0 ? 'FAILED' : 'PASSED'}
              </span>
              <span className="text-xs text-text-muted">{health.latest_test_run.framework}</span>
              <span className="text-xs text-text-muted">{timeAgo(health.latest_test_run.created_at)}</span>
            </div>

            {/* Pass/fail bar */}
            <div className="flex h-2 rounded-full overflow-hidden bg-surface-subtle mb-2">
              {health.latest_test_run.passed > 0 && (
                <div
                  className="bg-status-success"
                  style={{ width: `${(health.latest_test_run.passed / health.latest_test_run.total_tests) * 100}%` }}
                />
              )}
              {health.latest_test_run.failed > 0 && (
                <div
                  className="bg-status-error"
                  style={{ width: `${(health.latest_test_run.failed / health.latest_test_run.total_tests) * 100}%` }}
                />
              )}
              {health.latest_test_run.skipped > 0 && (
                <div
                  className="bg-text-muted"
                  style={{ width: `${(health.latest_test_run.skipped / health.latest_test_run.total_tests) * 100}%` }}
                />
              )}
            </div>

            <div className="flex gap-4 text-xs text-text-muted">
              <span className="text-status-success">{health.latest_test_run.passed} passed</span>
              <span className="text-status-error">{health.latest_test_run.failed} failed</span>
              {health.latest_test_run.skipped > 0 && (
                <span>{health.latest_test_run.skipped} skipped</span>
              )}
              {health.latest_test_run.duration_ms && (
                <span>{(health.latest_test_run.duration_ms / 1000).toFixed(1)}s</span>
              )}
            </div>

            {/* Failure details */}
            {health.latest_test_run.failures.length > 0 && (
              <div className="mt-2 space-y-1">
                {health.latest_test_run.failures.slice(0, 5).map((f, i) => (
                  <div key={i} className="text-xs text-status-error bg-status-error/5 rounded px-2 py-1">
                    <XCircle size={10} className="inline mr-1" />
                    {f.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-text-muted">No test runs recorded</p>
        )}
      </section>

      {/* Build Status */}
      <section className="rounded-lg border border-border-subtle bg-surface-raised p-4">
        <h2 className="text-sm font-semibold text-text-secondary flex items-center gap-2 mb-3">
          <Hammer size={14} /> Build
        </h2>
        {health.latest_build ? (
          <div className="flex items-center gap-3">
            <span className={cn(
              'text-xs font-medium px-2 py-0.5 rounded',
              health.latest_build.status === 'SUCCESS'
                ? 'bg-status-success/10 text-status-success'
                : 'bg-status-error/10 text-status-error',
            )}>
              {health.latest_build.status}
            </span>
            <span className="text-xs text-text-muted">{health.latest_build.build_type}</span>
            <span className="text-xs text-text-muted">{timeAgo(health.latest_build.created_at)}</span>
            {health.latest_build.duration_ms && (
              <span className="text-xs text-text-muted">{(health.latest_build.duration_ms / 1000).toFixed(1)}s</span>
            )}
          </div>
        ) : (
          <p className="text-xs text-text-muted">No build results recorded</p>
        )}
      </section>

      {/* Git Status */}
      <section className="rounded-lg border border-border-subtle bg-surface-raised p-4">
        <h2 className="text-sm font-semibold text-text-secondary flex items-center gap-2 mb-3">
          <GitBranch size={14} /> Git
        </h2>
        {health.latest_git ? (
          <div>
            <div className="flex items-center gap-3 mb-2 text-xs">
              <span className="text-text-primary font-medium">{health.latest_git.branch}</span>
              <span className="text-text-muted font-mono">{health.latest_git.commit_hash.slice(0, 7)}</span>
              <span className="text-text-muted">{timeAgo(health.latest_git.created_at)}</span>
            </div>

            {totalChanged > 0 && (
              <div className="space-y-1 mt-2">
                {health.latest_git.modified_files.slice(0, 10).map((f) => (
                  <div key={f} className="flex items-center gap-2 text-[11px]">
                    <FileText size={10} className="text-status-warning shrink-0" />
                    <span className="text-text-secondary font-mono truncate">{f}</span>
                    <span className="text-status-warning text-[10px]">M</span>
                  </div>
                ))}
                {health.latest_git.added_files.slice(0, 5).map((f) => (
                  <div key={f} className="flex items-center gap-2 text-[11px]">
                    <FileText size={10} className="text-status-success shrink-0" />
                    <span className="text-text-secondary font-mono truncate">{f}</span>
                    <span className="text-status-success text-[10px]">A</span>
                  </div>
                ))}
                {health.latest_git.deleted_files.slice(0, 5).map((f) => (
                  <div key={f} className="flex items-center gap-2 text-[11px]">
                    <FileText size={10} className="text-status-error shrink-0" />
                    <span className="text-text-secondary font-mono truncate">{f}</span>
                    <span className="text-status-error text-[10px]">D</span>
                  </div>
                ))}
                {totalChanged > 20 && (
                  <p className="text-[10px] text-text-muted">...and {totalChanged - 20} more files</p>
                )}
              </div>
            )}

            {health.latest_git.diff_stats.additions !== undefined && (
              <div className="flex gap-3 mt-2 text-xs text-text-muted">
                <span className="text-status-success">+{health.latest_git.diff_stats.additions}</span>
                <span className="text-status-error">-{health.latest_git.diff_stats.deletions ?? 0}</span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-text-muted">No git status recorded</p>
        )}
      </section>
    </div>
  );
}
