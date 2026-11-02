'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Layers, Search, Globe, Lock } from 'lucide-react';
import { fetchWorkflows } from '@/lib/api/workflows';
import { cn } from '@/lib/utils/cn';
import { timeAgo } from '@/lib/utils/format';

const CATEGORIES = ['all', 'software-development', 'testing', 'security', 'refactoring', 'documentation'] as const;

export default function WorkflowsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['workflows', category, search],
    queryFn: () => fetchWorkflows({
      category: category === 'all' ? undefined : category,
      q: search || undefined,
    }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Workflows</h1>
        <Link
          href="/dashboard/workflows/new"
          className="rounded-md bg-accent-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-primary/90 transition-colors min-h-[36px] flex items-center"
        >
          Create Workflow
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          placeholder="Search workflows..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-border bg-surface-subtle pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
      </div>

      {/* Categories */}
      <div className="flex gap-1 overflow-x-auto pb-px">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap',
              category === cat ? 'bg-surface-subtle text-text-primary' : 'text-text-muted hover:text-text-secondary',
            )}
          >
            {cat === 'all' ? 'All' : cat.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-surface-raised animate-pulse" />
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">No workflows found</p>
      ) : (
        <div className="space-y-2">
          {workflows.map((wf) => (
            <Link
              key={wf.id}
              href={`/dashboard/workflows/${wf.id}`}
              className="block rounded-lg border border-border-subtle bg-surface-raised p-4 hover:bg-surface-subtle transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  <Layers size={16} className="text-accent mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{wf.display_name}</p>
                    {wf.description && (
                      <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{wf.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-text-muted">
                      {wf.visibility === 'PUBLIC' ? (
                        <span className="flex items-center gap-0.5"><Globe size={9} /> Public</span>
                      ) : (
                        <span className="flex items-center gap-0.5"><Lock size={9} /> Private</span>
                      )}
                      {wf.latest_version && <span>v{wf.latest_version}</span>}
                      <span>{wf.version_count} versions</span>
                      <span>{timeAgo(wf.created_at)}</span>
                    </div>
                  </div>
                </div>
                <span className="text-[10px] rounded bg-surface-subtle px-1.5 py-0.5 text-text-muted shrink-0">
                  {wf.category}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
