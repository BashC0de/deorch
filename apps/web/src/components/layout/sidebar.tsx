'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Home, Shield, Terminal, Monitor, Bell, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useWs } from '@/lib/providers/ws-provider';
import { fetchApprovals } from '@/lib/api/approvals';

const navItems = [
  { label: 'Overview', href: '/dashboard', Icon: Home },
  { label: 'Approvals', href: '/dashboard/approvals', Icon: Shield },
  { label: 'Sessions', href: '/dashboard/sessions', Icon: Terminal },
  { label: 'Projects', href: '/dashboard/projects', Icon: FolderOpen },
  { label: 'Devices', href: '/dashboard/devices', Icon: Monitor },
  { label: 'Activity', href: '/dashboard/notifications', Icon: Bell },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isConnected } = useWs();
  const { data: approvals = [] } = useQuery({
    queryKey: ['approvals', 'PENDING'],
    queryFn: () => fetchApprovals('PENDING'),
    refetchInterval: 10_000,
  });
  const pendingCount = approvals.length;

  return (
    <aside className="hidden md:flex md:w-56 lg:w-64 flex-col border-r border-border-subtle bg-surface-base">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border-subtle">
        <span className="text-lg font-bold tracking-tight">DeOrch</span>
        <div className="ml-auto flex items-center gap-1.5">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              isConnected ? 'bg-status-success' : 'bg-status-error',
            )}
          />
          <span className="text-[10px] text-text-muted">
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      <nav className="flex-1 py-3 px-3 space-y-0.5">
        {navItems.map((item) => {
          const active =
            item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-surface-subtle text-text-primary'
                  : 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary',
              )}
            >
              <item.Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
              <span className="flex-1">{item.label}</span>
              {item.href === '/dashboard/approvals' && pendingCount > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-status-error px-1.5 text-[10px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
