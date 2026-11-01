'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { fetchDevice, revokeDevice } from '@/lib/api/devices';
import { cn } from '@/lib/utils/cn';
import { timeAgo, statusColor } from '@/lib/utils/format';
import { useState } from 'react';

export default function DeviceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const { data: device } = useQuery({
    queryKey: ['devices', id],
    queryFn: () => fetchDevice(id),
  });

  const revokeMutation = useMutation({
    mutationFn: () => revokeDevice(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['devices'] });
    },
  });

  if (!device) {
    return <div className="animate-pulse h-64 bg-surface-raised rounded-lg" />;
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <button onClick={() => router.back()} className="text-xs text-text-muted hover:text-text-secondary">
        &larr; Back
      </button>

      <div className="rounded-lg border border-border-subtle bg-surface-raised p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'h-3 w-3 rounded-full',
                device.status === 'ACTIVE' || device.status === 'PAIRED' ? 'bg-status-success'
                  : device.status === 'REVOKED' ? 'bg-status-error'
                  : 'bg-text-muted',
              )}
            />
            <h1 className="text-base font-semibold">{device.name}</h1>
          </div>
          <span className={cn('text-xs font-medium', statusColor(device.status))}>
            {device.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs text-text-muted">
          <div>
            <p className="text-text-secondary font-medium">Hostname</p>
            <p>{device.hostname ?? 'Unknown'}</p>
          </div>
          <div>
            <p className="text-text-secondary font-medium">Registered</p>
            <p>{timeAgo(device.created_at)}</p>
          </div>
          {device.paired_at && (
            <div>
              <p className="text-text-secondary font-medium">Paired</p>
              <p>{timeAgo(device.paired_at)}</p>
            </div>
          )}
          {device.last_seen_at && (
            <div>
              <p className="text-text-secondary font-medium">Last Seen</p>
              <p>{timeAgo(device.last_seen_at)}</p>
            </div>
          )}
        </div>
      </div>

      {device.status !== 'REVOKED' && (
        <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
          {!confirmRevoke ? (
            <button
              onClick={() => setConfirmRevoke(true)}
              className="w-full rounded-md border border-status-error/30 bg-status-error/5 px-4 py-2.5 text-sm font-medium text-status-error hover:bg-status-error/10 transition-colors"
            >
              Revoke Device
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-text-muted text-center">This will permanently disable this device. It cannot be undone.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => revokeMutation.mutate()}
                  disabled={revokeMutation.isPending}
                  className="flex-1 rounded-md bg-status-error px-4 py-2.5 text-sm font-semibold text-white hover:bg-status-error/90 disabled:opacity-50 min-h-[44px]"
                >
                  {revokeMutation.isPending ? 'Revoking...' : 'Confirm Revoke'}
                </button>
                <button
                  onClick={() => setConfirmRevoke(false)}
                  className="rounded-md bg-surface-subtle border border-border px-4 py-2.5 text-sm text-text-muted min-h-[44px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
