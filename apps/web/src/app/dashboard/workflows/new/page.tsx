'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createWorkflow } from '@/lib/api/workflows';

export default function NewWorkflowPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('software-development');
  const [visibility, setVisibility] = useState<'PRIVATE' | 'PUBLIC'>('PRIVATE');

  const mutation = useMutation({
    mutationFn: () =>
      createWorkflow({ name, display_name: displayName, description: description || undefined, category, visibility }),
    onSuccess: (wf) => {
      void queryClient.invalidateQueries({ queryKey: ['workflows'] });
      router.push(`/dashboard/workflows/${wf.id}`);
    },
  });

  return (
    <div className="space-y-4 max-w-lg">
      <button onClick={() => router.back()} className="text-xs text-text-muted hover:text-text-secondary">
        &larr; Back
      </button>

      <h1 className="text-lg font-semibold">Create Workflow</h1>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-text-muted mb-1">Workflow Slug</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            placeholder="my-workflow"
            className="w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="block text-xs text-text-muted mb-1">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="My Workflow"
            className="w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="block text-xs text-text-muted mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What does this workflow do?"
            rows={3}
            className="w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent resize-none"
          />
        </div>

        <div>
          <label className="block text-xs text-text-muted mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-border bg-surface-subtle px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="software-development">Software Development</option>
            <option value="testing">Testing & QA</option>
            <option value="security">Security</option>
            <option value="refactoring">Refactoring</option>
            <option value="documentation">Documentation</option>
            <option value="general">General</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-text-muted mb-1">Visibility</label>
          <div className="flex gap-2">
            <button
              onClick={() => setVisibility('PRIVATE')}
              className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${visibility === 'PRIVATE' ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-muted'}`}
            >
              Private
            </button>
            <button
              onClick={() => setVisibility('PUBLIC')}
              className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${visibility === 'PUBLIC' ? 'border-accent bg-accent/10 text-accent' : 'border-border text-text-muted'}`}
            >
              Public
            </button>
          </div>
        </div>

        <button
          onClick={() => mutation.mutate()}
          disabled={!name || !displayName || mutation.isPending}
          className="w-full rounded-md bg-accent-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-primary/90 disabled:opacity-50 transition-colors min-h-[44px]"
        >
          {mutation.isPending ? 'Creating...' : 'Create Workflow'}
        </button>

        {mutation.isError && (
          <p className="text-xs text-status-error text-center">
            {mutation.error instanceof Error ? mutation.error.message : 'Failed to create workflow'}
          </p>
        )}
      </div>
    </div>
  );
}
