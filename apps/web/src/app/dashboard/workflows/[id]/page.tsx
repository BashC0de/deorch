'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { Layers, Clock, Shield, GitBranch, Download } from 'lucide-react';
import { fetchWorkflow, fetchVersions } from '@/lib/api/workflows';
import { cn } from '@/lib/utils/cn';
import { timeAgo } from '@/lib/utils/format';

const TRUST_COLORS: Record<string, string> = {
  UNVERIFIED: 'text-text-muted',
  VALIDATED: 'text-status-warning',
  VERIFIED: 'text-status-success',
  DEPRECATED: 'text-text-muted',
  REVOKED: 'text-status-error',
};

export default function WorkflowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: workflow } = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => fetchWorkflow(id),
  });

  const { data: versions = [] } = useQuery({
    queryKey: ['workflow-versions', id],
    queryFn: () => fetchVersions(id),
  });

  if (!workflow) {
    return <div className="animate-pulse h-64 bg-surface-raised rounded-lg" />;
  }

  return (
    <div className="space-y-4">
      <button onClick={() => router.back()} className="text-xs text-text-muted hover:text-text-secondary">
        &larr; Back
      </button>

      {/* Header */}
      <div className="rounded-lg border border-border-subtle bg-surface-raised p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Layers size={20} className="text-accent mt-0.5 shrink-0" />
          <div>
            <h1 className="text-base font-semibold">{workflow.display_name}</h1>
            <p className="text-xs text-text-muted mt-0.5">{workflow.name}</p>
            {workflow.description && (
              <p className="text-sm text-text-secondary mt-2">{workflow.description}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="rounded bg-surface-subtle px-2 py-0.5 text-[10px] text-text-muted">{workflow.category}</span>
          {workflow.tags.map((tag) => (
            <span key={tag} className="rounded bg-surface-subtle px-2 py-0.5 text-[10px] text-text-muted">{tag}</span>
          ))}
        </div>

        <div className="flex gap-4 text-xs text-text-muted">
          <span>{workflow.visibility}</span>
          <span>{workflow.version_count} versions</span>
          <span>Created {timeAgo(workflow.created_at)}</span>
        </div>
      </div>

      {/* Versions */}
      <div>
        <h2 className="text-sm font-semibold text-text-secondary mb-2">Versions ({versions.length})</h2>
        {versions.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-4">No versions published</p>
        ) : (
          <div className="space-y-1.5">
            {versions.map((v) => {
              const taskCount = Array.isArray(v.definition?.tasks) ? v.definition.tasks.length : 0;
              return (
                <div
                  key={v.id}
                  className="rounded-md border border-border-subtle bg-surface-raised p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <GitBranch size={14} className="text-accent" />
                      <div>
                        <span className="text-sm font-medium">v{v.version_number}</span>
                        <span className={cn('ml-2 text-[10px] font-medium', TRUST_COLORS[v.trust_status] ?? 'text-text-muted')}>
                          {v.trust_status}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-text-muted">{timeAgo(v.created_at)}</span>
                  </div>
                  <div className="mt-1 text-xs text-text-muted flex gap-3">
                    <span>{taskCount} tasks</span>
                    {v.changelog && <span>{v.changelog}</span>}
                  </div>
                  <p className="mt-1 text-[10px] font-mono text-text-muted truncate">
                    {v.checksum.slice(0, 16)}...
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
