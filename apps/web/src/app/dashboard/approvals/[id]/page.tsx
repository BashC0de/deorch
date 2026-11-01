'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { fetchApproval, decideApproval } from '@/lib/api/approvals';
import { cn } from '@/lib/utils/cn';
import { timeAgo, timeUntil, riskColor, riskBgColor, statusColor } from '@/lib/utils/format';

export default function ApprovalDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const { data: approval, isLoading } = useQuery({
    queryKey: ['approvals', id],
    queryFn: () => fetchApproval(id),
    refetchInterval: 3000,
  });

  const [confirmAction, setConfirmAction] = useState<'APPROVE' | 'DENY' | null>(null);
  const [denyReason, setDenyReason] = useState('');
  const [countdown, setCountdown] = useState('');

  const mutation = useMutation({
    mutationFn: ({ decision, reason }: { decision: 'APPROVE' | 'DENY'; reason?: string }) =>
      decideApproval(id, decision, reason),
    onSuccess: () => {
      setConfirmAction(null);
      void queryClient.invalidateQueries({ queryKey: ['approvals'] });
    },
  });

  // Countdown timer
  useEffect(() => {
    if (!approval || approval.status !== 'PENDING') return;
    const timer = setInterval(() => {
      setCountdown(timeUntil(approval.expires_at));
    }, 1000);
    setCountdown(timeUntil(approval.expires_at));
    return () => clearInterval(timer);
  }, [approval]);

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-surface-raised rounded-lg" />;
  }

  if (!approval) {
    return <p className="text-text-muted text-center py-8">Request not found</p>;
  }

  const isPending = approval.status === 'PENDING' && countdown !== 'Expired';
  const details = approval.details;

  return (
    <div className="space-y-4 max-w-2xl">
      <button onClick={() => router.back()} className="text-xs text-text-muted hover:text-text-secondary">
        &larr; Back
      </button>

      {/* Header */}
      <div className="rounded-lg border border-border-subtle bg-surface-raised p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-base font-semibold">{approval.action_summary}</h1>
            {approval.tool_name && (
              <span className="inline-flex items-center gap-1 mt-1 rounded bg-surface-subtle px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
                {approval.tool_name}
              </span>
            )}
          </div>
          <span className={cn('text-xs font-medium whitespace-nowrap', statusColor(approval.status))}>
            {approval.status}
          </span>
        </div>

        {approval.risk_level && (
          <div className={cn('inline-flex rounded-md border px-2 py-0.5 text-xs font-medium', riskBgColor(approval.risk_level), riskColor(approval.risk_level))}>
            Risk: {approval.risk_level}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs text-text-muted">
          <div>
            <p className="text-text-secondary font-medium">Type</p>
            <p>{approval.request_type}</p>
          </div>
          <div>
            <p className="text-text-secondary font-medium">Created</p>
            <p>{timeAgo(approval.created_at)}</p>
          </div>
          {approval.hook_event_name && (
            <div>
              <p className="text-text-secondary font-medium">Hook</p>
              <p>{approval.hook_event_name}</p>
            </div>
          )}
          {approval.session_id && (
            <div>
              <p className="text-text-secondary font-medium">Session</p>
              <a href={`/dashboard/sessions/${approval.session_id}`} className="text-accent-primary hover:underline">
                View session
              </a>
            </div>
          )}
          {approval.working_directory && (
            <div className="col-span-2">
              <p className="text-text-secondary font-medium">Directory</p>
              <p className="font-mono text-[11px]">{approval.working_directory}</p>
            </div>
          )}
          {approval.reason && (
            <div className="col-span-2">
              <p className="text-text-secondary font-medium">Reason</p>
              <p>{approval.reason}</p>
            </div>
          )}
        </div>
      </div>

      {/* Command details */}
      {details && Object.keys(details).length > 0 && (
        <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
          <p className="text-xs font-medium text-text-secondary mb-2">Details</p>
          <pre className="text-xs font-mono text-text-primary bg-surface-base rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(details, null, 2)}
          </pre>
        </div>
      )}

      {/* Expiry countdown */}
      {isPending && (
        <div className="rounded-lg border border-border-subtle bg-surface-raised p-3 text-center">
          <p className="text-xs text-text-muted">Expires in</p>
          <p className={cn('text-lg font-bold font-mono', countdown === 'Expired' ? 'text-status-error' : 'text-status-warning')}>
            {countdown}
          </p>
        </div>
      )}

      {/* Decision buttons */}
      {isPending && (
        <div className="space-y-2">
          {!confirmAction ? (
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmAction('APPROVE')}
                className="flex-1 rounded-md bg-status-success/10 border border-status-success/30 px-4 py-3 text-sm font-semibold text-status-success hover:bg-status-success/20 transition-colors min-h-[48px]"
              >
                Approve
              </button>
              <button
                onClick={() => setConfirmAction('DENY')}
                className="flex-1 rounded-md bg-surface-subtle border border-border px-4 py-3 text-sm font-semibold text-text-primary hover:bg-surface-overlay transition-colors min-h-[48px]"
              >
                Deny
              </button>
            </div>
          ) : confirmAction === 'APPROVE' ? (
            <div className="space-y-2">
              <p className="text-xs text-text-muted text-center">Confirm approval?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => mutation.mutate({ decision: 'APPROVE' })}
                  disabled={mutation.isPending}
                  className="flex-1 rounded-md bg-status-success px-4 py-3 text-sm font-semibold text-white hover:bg-status-success/90 disabled:opacity-50 transition-colors min-h-[48px]"
                >
                  {mutation.isPending ? 'Approving...' : 'Confirm Approve'}
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  className="rounded-md bg-surface-subtle border border-border px-4 py-3 text-sm text-text-muted min-h-[48px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Reason for denial (optional)"
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                className="w-full rounded-md bg-surface-raised border border-border px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => mutation.mutate({ decision: 'DENY', reason: denyReason || undefined })}
                  disabled={mutation.isPending}
                  className="flex-1 rounded-md bg-status-error px-4 py-3 text-sm font-semibold text-white hover:bg-status-error/90 disabled:opacity-50 transition-colors min-h-[48px]"
                >
                  {mutation.isPending ? 'Denying...' : 'Confirm Deny'}
                </button>
                <button
                  onClick={() => { setConfirmAction(null); setDenyReason(''); }}
                  className="rounded-md bg-surface-subtle border border-border px-4 py-3 text-sm text-text-muted min-h-[48px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {mutation.isError && (
            <p className="text-xs text-status-error text-center">
              {mutation.error instanceof Error ? mutation.error.message : 'Failed'}
            </p>
          )}
        </div>
      )}

      {/* Decision result */}
      {approval.decision && (
        <div className={cn(
          'rounded-lg border p-4',
          approval.decision.decision === 'APPROVE' || approval.decision.decision === 'APPROVED'
            ? 'border-status-success/20 bg-status-success/5'
            : 'border-status-error/20 bg-status-error/5',
        )}>
          <p className="text-sm font-medium">
            {approval.decision.decision === 'APPROVE' || approval.decision.decision === 'APPROVED' ? 'Approved' : 'Denied'}{' '}
            <span className="text-text-muted font-normal">{timeAgo(approval.decision.decided_at)}</span>
          </p>
          {approval.decision.reason && (
            <p className="text-xs text-text-secondary mt-1">{approval.decision.reason}</p>
          )}
          {approval.decision.delivered_at && (
            <p className="text-xs text-text-muted mt-1">Delivered to agent {timeAgo(approval.decision.delivered_at)}</p>
          )}
        </div>
      )}
    </div>
  );
}
