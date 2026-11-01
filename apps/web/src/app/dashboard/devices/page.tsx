'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchDevices } from '@/lib/api/devices';
import { cn } from '@/lib/utils/cn';
import { timeAgo, statusColor } from '@/lib/utils/format';
import { ConnectMachineModal } from '@/components/pairing/connect-machine-modal';

export default function DevicesPage() {
  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['devices'],
    queryFn: fetchDevices,
    refetchInterval: 10000,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Devices</h1>
        <ConnectMachineModal />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-surface-raised animate-pulse" />
          ))}
        </div>
      ) : devices.length === 0 ? (
        <p className="text-sm text-text-muted text-center py-8">
          No devices registered. Run the local companion and complete pairing to get started.
        </p>
      ) : (
        <div className="space-y-2">
          {devices.map((d) => (
            <Link
              key={d.id}
              href={`/dashboard/devices/${d.id}`}
              className="block rounded-lg border border-border-subtle bg-surface-raised p-3 hover:bg-surface-subtle transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      'h-2.5 w-2.5 rounded-full',
                      d.status === 'ACTIVE' || d.status === 'PAIRED'
                        ? 'bg-status-success'
                        : d.status === 'REVOKED'
                          ? 'bg-status-error'
                          : 'bg-text-muted',
                    )}
                  />
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {d.hostname ?? 'Unknown host'}
                      {d.last_seen_at && ` · Last seen ${timeAgo(d.last_seen_at)}`}
                    </p>
                  </div>
                </div>
                <span className={cn('text-xs font-medium', statusColor(d.status))}>
                  {d.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
