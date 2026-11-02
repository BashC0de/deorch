'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Settings, Users, CreditCard, Shield } from 'lucide-react';
import { api } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

interface OrgInfo {
  id: string;
  name: string;
  display_name: string;
  owner_id: string;
  created_at: string;
}

export default function SettingsPage() {
  const { data: orgs = [] } = useQuery({
    queryKey: ['orgs'],
    queryFn: () => api<OrgInfo[]>('/api/v1/workflows/orgs'),
  });

  const sections = [
    { label: 'Billing & Plan', href: '/dashboard/settings/billing', Icon: CreditCard, description: 'Manage subscription and usage' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Settings</h1>

      {/* Organizations */}
      <section>
        <h2 className="text-sm font-semibold text-text-secondary mb-2">Organizations</h2>
        {orgs.length === 0 ? (
          <p className="text-sm text-text-muted rounded-lg border border-border-subtle bg-surface-raised p-4 text-center">
            No organizations. Create one from the Workflows page.
          </p>
        ) : (
          <div className="space-y-2">
            {orgs.map((org) => (
              <div key={org.id} className="rounded-lg border border-border-subtle bg-surface-raised p-4">
                <div className="flex items-center gap-3">
                  <Users size={16} className="text-accent" />
                  <div>
                    <p className="text-sm font-medium">{org.display_name}</p>
                    <p className="text-xs text-text-muted">{org.name}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Settings sections */}
      <section>
        <h2 className="text-sm font-semibold text-text-secondary mb-2">Manage</h2>
        <div className="space-y-2">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-raised p-4 hover:bg-surface-subtle transition-colors"
            >
              <s.Icon size={16} className="text-text-muted" />
              <div>
                <p className="text-sm font-medium">{s.label}</p>
                <p className="text-xs text-text-muted">{s.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
