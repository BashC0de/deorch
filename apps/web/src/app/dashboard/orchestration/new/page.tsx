'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createRun } from '@/lib/api/orchestration';
import { fetchWorkflows, fetchInstallations, executeInstallation } from '@/lib/api/workflows';
import { useQuery } from '@tanstack/react-query';

export default function NewRunPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'scratch' | 'workflow'>('scratch');
  const [objective, setObjective] = useState('');
  const [description, setDescription] = useState('');
  const [maxConcurrent, setMaxConcurrent] = useState(3);

  const { data: installations = [] } = useQuery({
    queryKey: ['workflow-installations'],
    queryFn: fetchInstallations,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createRun({ objective, description: description || undefined, max_concurrent_tasks: maxConcurrent }),
    onSuccess: (run) => {
      void queryClient.invalidateQueries({ queryKey: ['orchestration-runs'] });
      router.push(`/dashboard/orchestration/${run.id}`);
    },
  });

  const executeMutation = useMutation({
    mutationFn: (installId: string) => executeInstallation(installId),
    onSuccess: (run) => {
      void queryClient.invalidateQueries({ queryKey: ['orchestration-runs'] });
      router.push(`/dashboard/orchestration/${run.id}`);
    },
  });

  return (
    <div className="space-y-4 max-w-lg">
      <button onClick={() => router.back()} className="text-xs text-text-muted hover:text-text-secondary">
        &larr; Back
      </button>

      <h1 className="text-lg font-semibold">New Orchestration Run</h1>

      {/* Mode selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('scratch')}
          className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${mode === 'scratch' ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-muted'}`}
        >
          From Scratch
        </button>
        <button
          onClick={() => setMode('workflow')}
          className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${mode === 'workflow' ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-muted'}`}
        >
          From Workflow
        </button>
      </div>

      {mode === 'scratch' ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-text-muted mb-1">Objective</label>
            <textarea
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Describe the engineering objective..."
              rows={3}
              className="w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional context..."
              className="w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs text-text-muted mb-1">Max Concurrent Tasks</label>
            <input
              type="number"
              min={1}
              max={20}
              value={maxConcurrent}
              onChange={(e) => setMaxConcurrent(parseInt(e.target.value, 10) || 3)}
              className="w-24 rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
            />
          </div>

          <button
            onClick={() => createMutation.mutate()}
            disabled={!objective.trim() || createMutation.isPending}
            className="w-full rounded-md bg-accent-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-primary/90 disabled:opacity-50 transition-colors min-h-[44px]"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Run'}
          </button>

          {createMutation.isError && (
            <p className="text-xs text-status-error text-center">
              {createMutation.error instanceof Error ? createMutation.error.message : 'Failed'}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-text-muted">Select an installed workflow to execute:</p>

          {installations.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8 rounded-lg border border-border-subtle bg-surface-raised">
              No workflows installed. Visit the Workflows page to install one.
            </p>
          ) : (
            <div className="space-y-2">
              {installations.map((inst) => (
                <div
                  key={inst.id}
                  className="rounded-lg border border-border-subtle bg-surface-raised p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm font-medium">Workflow {inst.workflow_id.slice(0, 8)}...</p>
                    <p className="text-[10px] text-text-muted">Version: {inst.workflow_version_id.slice(0, 8)}...</p>
                  </div>
                  <button
                    onClick={() => executeMutation.mutate(inst.id)}
                    disabled={executeMutation.isPending}
                    className="rounded-md bg-accent/10 border border-accent/30 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/20 min-h-[36px]"
                  >
                    Execute
                  </button>
                </div>
              ))}
            </div>
          )}

          {executeMutation.isError && (
            <p className="text-xs text-status-error text-center">
              {executeMutation.error instanceof Error ? executeMutation.error.message : 'Execution failed'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
