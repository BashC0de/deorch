'use client';

import { useQuery } from '@tanstack/react-query';
import { Cpu, CheckCircle, XCircle, Terminal } from 'lucide-react';
import { api } from '@/lib/api/client';
import { fetchSessions } from '@/lib/api/sessions';
import { cn } from '@/lib/utils/cn';

interface AgentProvider {
  id: string;
  slug: string;
  display_name: string;
  capabilities: string[];
  is_supported: boolean;
  created_at: string;
}

// Fetch providers from the seeded agent_providers table via sessions endpoint metadata
async function fetchProviderSummary(): Promise<AgentProvider[]> {
  // The agent_providers table is seeded in the backend but not exposed via a dedicated endpoint.
  // We derive provider info from session data and known provider list.
  return [
    { id: '1', slug: 'claude-code', display_name: 'Claude Code', capabilities: ['pre_tool_approval', 'post_tool_observe', 'session_tracking', 'notifications'], is_supported: true, created_at: '' },
    { id: '2', slug: 'codex', display_name: 'OpenAI Codex', capabilities: ['pre_tool_approval', 'post_tool_observe', 'session_tracking'], is_supported: true, created_at: '' },
    { id: '3', slug: 'gemini', display_name: 'Gemini CLI', capabilities: ['pre_tool_approval', 'post_tool_observe', 'session_tracking'], is_supported: true, created_at: '' },
    { id: '4', slug: 'copilot', display_name: 'GitHub Copilot', capabilities: [], is_supported: false, created_at: '' },
    { id: '5', slug: 'cursor', display_name: 'Cursor', capabilities: [], is_supported: false, created_at: '' },
  ];
}

export default function ProvidersPage() {
  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: fetchProviderSummary,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions'],
    queryFn: fetchSessions,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Agent Providers</h1>

      <div className="space-y-2">
        {providers.map((p) => {
          const activeSessions = sessions.filter((s) => s.provider_slug === p.slug && s.status === 'ACTIVE');
          const totalSessions = sessions.filter((s) => s.provider_slug === p.slug);

          return (
            <div
              key={p.slug}
              className="rounded-lg border border-border-subtle bg-surface-raised p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg',
                    p.is_supported ? 'bg-accent/10 text-accent' : 'bg-surface-subtle text-text-muted',
                  )}>
                    <Terminal size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{p.display_name}</p>
                    <p className="text-xs text-text-muted">{p.slug}</p>
                  </div>
                </div>
                <span className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded',
                  p.is_supported
                    ? 'bg-status-success/10 text-status-success'
                    : 'bg-surface-subtle text-text-muted',
                )}>
                  {p.is_supported ? 'Supported' : 'Coming Soon'}
                </span>
              </div>

              {p.is_supported && (
                <div className="mt-3 flex items-center gap-4 text-xs text-text-muted">
                  <span>{activeSessions.length} active</span>
                  <span>{totalSessions.length} total sessions</span>
                </div>
              )}

              {p.capabilities.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.capabilities.map((cap) => (
                    <span key={cap} className="inline-flex items-center gap-0.5 rounded bg-surface-subtle px-1.5 py-0.5 text-[10px] text-text-muted">
                      <CheckCircle size={8} className="text-status-success" />
                      {cap.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
