'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Plug, Github, MessageSquare, CheckCircle, Shield } from 'lucide-react';
import { fetchIntegrations } from '@/lib/api/integrations';
import { cn } from '@/lib/utils/cn';

const CATEGORY_LABELS: Record<string, string> = {
  source_control: 'Source Control',
  communication: 'Communication',
  project_mgmt: 'Project Management',
  ci_cd: 'CI/CD',
};

const PROVIDER_ICONS: Record<string, typeof Plug> = {
  github: Github,
  slack: MessageSquare,
};

export default function IntegrationsPage() {
  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => fetchIntegrations(),
  });

  // Group by category
  const grouped = integrations.reduce<Record<string, typeof integrations>>((acc, i) => {
    const cat = i.category;
    (acc[cat] ??= []).push(i);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Integrations</h1>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-20 rounded-lg bg-surface-raised animate-pulse" />)}
        </div>
      ) : integrations.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">No integrations available</p>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <section key={category}>
            <h2 className="text-sm font-semibold text-text-secondary mb-2">
              {CATEGORY_LABELS[category] ?? category}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {items.map((i) => {
                const Icon = PROVIDER_ICONS[i.provider] ?? Plug;
                return (
                  <Link
                    key={i.id}
                    href={`/dashboard/integrations/${i.slug}`}
                    className="rounded-lg border border-border-subtle bg-surface-raised p-4 hover:bg-surface-subtle transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-subtle">
                        <Icon size={20} className="text-text-secondary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{i.name}</p>
                          {i.trust_status === 'VERIFIED' && (
                            <CheckCircle size={12} className="text-status-success" />
                          )}
                        </div>
                        {i.description && (
                          <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{i.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-2">
                          {i.capabilities.slice(0, 4).map((cap) => (
                            <span key={cap} className="rounded bg-surface-subtle px-1.5 py-0.5 text-[10px] text-text-muted">
                              {cap.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
