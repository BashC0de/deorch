'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { Plug, CheckCircle, Shield, Lock } from 'lucide-react';
import { fetchIntegrations } from '@/lib/api/integrations';
import { cn } from '@/lib/utils/cn';

export default function IntegrationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const { data: integrations = [] } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => fetchIntegrations(),
  });

  const integration = integrations.find((i) => i.slug === slug);

  if (!integration) {
    return <div className="animate-pulse h-64 bg-surface-raised rounded-lg" />;
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <button onClick={() => router.back()} className="text-xs text-text-muted hover:text-text-secondary">
        &larr; Back
      </button>

      <div className="rounded-lg border border-border-subtle bg-surface-raised p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-subtle">
            <Plug size={24} className="text-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold">{integration.name}</h1>
              {integration.trust_status === 'VERIFIED' && (
                <span className="flex items-center gap-0.5 text-[10px] text-status-success">
                  <CheckCircle size={10} /> Verified
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted">{integration.category.replace(/_/g, ' ')}</p>
          </div>
        </div>

        {integration.description && (
          <p className="text-sm text-text-secondary">{integration.description}</p>
        )}
      </div>

      {/* Capabilities */}
      <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
        <h2 className="text-sm font-semibold text-text-secondary mb-2">Capabilities</h2>
        <div className="flex flex-wrap gap-1.5">
          {integration.capabilities.map((cap) => (
            <span key={cap} className="flex items-center gap-1 rounded-md bg-status-success/10 px-2 py-1 text-xs text-status-success">
              <CheckCircle size={10} />
              {cap.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      </div>

      {/* Required Permissions */}
      <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
        <h2 className="text-sm font-semibold text-text-secondary mb-2">Required Permissions</h2>
        <div className="space-y-1">
          {integration.required_permissions.map((perm) => (
            <div key={perm} className="flex items-center gap-2 text-xs text-text-muted">
              <Shield size={10} />
              {perm.replace(/_/g, ' ')}
            </div>
          ))}
        </div>
      </div>

      {/* Auth info */}
      <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
        <h2 className="text-sm font-semibold text-text-secondary mb-2">Authentication</h2>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <Lock size={12} />
          <span>{integration.auth_type === 'token' ? 'API Token' : integration.auth_type === 'oauth' ? 'OAuth 2.0' : integration.auth_type}</span>
        </div>
        <p className="text-xs text-text-muted mt-2">
          Connect this integration from Settings → Integrations in your organization admin panel.
        </p>
      </div>
    </div>
  );
}
