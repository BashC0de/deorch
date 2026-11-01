'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { fetchSession, fetchSessionEvents } from '@/lib/api/sessions';
import { cn } from '@/lib/utils/cn';
import { timeAgo, statusColor } from '@/lib/utils/format';
import type { AgentEvent } from '@/lib/types/api';
import { useEffect, useRef } from 'react';

const EVENT_ICONS: Record<string, { icon: string; label: string; color: string }> = {
  'session.started': { icon: '▶', label: 'Session started', color: 'text-status-success' },
  'session.ended': { icon: '■', label: 'Session ended', color: 'text-text-muted' },
  'tool.pre_use': { icon: '🔧', label: 'Tool requested', color: 'text-accent-primary' },
  'tool.post_use': { icon: '✓', label: 'Tool completed', color: 'text-status-success' },
  'tool.failed': { icon: '✗', label: 'Tool failed', color: 'text-status-error' },
  'approval.requested': { icon: '🛡', label: 'Approval required', color: 'text-status-warning' },
  'approval.approved': { icon: '✓', label: 'Approved', color: 'text-status-success' },
  'approval.denied': { icon: '✗', label: 'Denied', color: 'text-status-error' },
  'prompt.submitted': { icon: '💬', label: 'Prompt', color: 'text-text-secondary' },
  'notification': { icon: '🔔', label: 'Notification', color: 'text-text-secondary' },
};

function getEventDisplay(event: AgentEvent) {
  const meta = EVENT_ICONS[event.event_type] ?? { icon: '•', label: event.event_type, color: 'text-text-muted' };
  const payload = event.payload;

  let summary = '';
  if (event.event_type === 'tool.pre_use' || event.event_type === 'tool.post_use' || event.event_type === 'tool.failed') {
    const tool = String(payload['tool'] ?? '');
    const input = payload['input'] as Record<string, unknown> | undefined;
    const cmd = input?.['command'] ? String(input['command']).slice(0, 120) : '';
    summary = cmd ? `${tool}: ${cmd}` : tool;
  } else if (event.event_type === 'notification') {
    summary = String(payload['message'] ?? '');
  } else if (event.event_type === 'prompt.submitted') {
    summary = String(payload['prompt_preview'] ?? '').slice(0, 120);
  } else if (event.event_type === 'session.started') {
    summary = payload['cwd'] ? `cwd: ${String(payload['cwd'])}` : '';
  }

  return { ...meta, summary };
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: session } = useQuery({
    queryKey: ['sessions', id],
    queryFn: () => fetchSession(id),
  });

  const { data: events = [] } = useQuery({
    queryKey: ['sessions', id, 'events'],
    queryFn: () => fetchSessionEvents(id),
    refetchInterval: session?.status === 'ACTIVE' ? 3000 : false,
  });

  // Auto-scroll to latest event on active sessions
  useEffect(() => {
    if (session?.status === 'ACTIVE' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events.length, session?.status]);

  if (!session) {
    return <div className="animate-pulse h-64 bg-surface-raised rounded-lg" />;
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <button onClick={() => router.back()} className="text-xs text-text-muted hover:text-text-secondary">
        &larr; Back
      </button>

      <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold">{session.provider_slug}</h1>
            <p className="text-xs text-text-muted mt-0.5">
              Started {timeAgo(session.started_at ?? session.created_at)}
              {session.ended_at && ` · Ended ${timeAgo(session.ended_at)}`}
            </p>
          </div>
          <span className={cn('text-xs font-medium', statusColor(session.status))}>
            {session.status}
          </span>
        </div>
        {session.external_session_id && (
          <p className="text-[10px] font-mono text-text-muted mt-2 break-all">
            Session: {session.external_session_id}
          </p>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-text-secondary mb-2">
          Activity Timeline ({events.length})
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-4">No events yet</p>
        ) : (
          <div ref={scrollRef} className="space-y-0 max-h-[60vh] overflow-y-auto">
            {events.map((e, i) => {
              const display = getEventDisplay(e);
              return (
                <div key={e.id} className="flex gap-3 group">
                  {/* Timeline line + dot */}
                  <div className="flex flex-col items-center w-5 shrink-0">
                    <span className={cn('text-xs leading-none mt-2.5', display.color)}>
                      {display.icon}
                    </span>
                    {i < events.length - 1 && (
                      <div className="w-px flex-1 bg-border-subtle mt-1" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pb-3">
                    <div className="rounded-md border border-border-subtle bg-surface-raised p-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn('font-medium', display.color)}>{display.label}</span>
                        <span className="text-text-muted text-[10px] shrink-0">{timeAgo(e.created_at)}</span>
                      </div>
                      {display.summary && (
                        <p className="mt-1 text-[11px] font-mono text-text-secondary truncate">
                          {display.summary}
                        </p>
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
