'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { useWs } from '@/lib/providers/ws-provider';

const navItems = [
  { label: 'Overview', href: '/dashboard', icon: '◉' },
  { label: 'Approvals', href: '/dashboard/approvals', icon: '◈' },
  { label: 'Sessions', href: '/dashboard/sessions', icon: '▸' },
  { label: 'Devices', href: '/dashboard/devices', icon: '⊞' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isConnected } = useWs();

  return (
    <aside className="hidden md:flex md:w-56 lg:w-64 flex-col border-r border-border-subtle bg-surface-base">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border-subtle">
        <span className="text-lg font-bold tracking-tight">DeOrch</span>
        <span
          className={cn(
            'ml-auto h-2 w-2 rounded-full',
            isConnected ? 'bg-status-success' : 'bg-status-error',
          )}
          title={isConnected ? 'Connected' : 'Disconnected'}
        />
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
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
