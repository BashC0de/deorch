'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Home, Shield, Terminal, FolderOpen, Bell } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { fetchApprovals } from '@/lib/api/approvals';

const navItems = [
  { label: 'Home', href: '/dashboard', Icon: Home },
  { label: 'Approvals', href: '/dashboard/approvals', Icon: Shield },
  { label: 'Sessions', href: '/dashboard/sessions', Icon: Terminal },
  { label: 'Projects', href: '/dashboard/projects', Icon: FolderOpen },
  { label: 'Activity', href: '/dashboard/notifications', Icon: Bell },
];

export function MobileNav() {
  const pathname = usePathname();
  const { data: approvals = [] } = useQuery({
    queryKey: ['approvals', 'PENDING'],
    queryFn: () => fetchApprovals('PENDING'),
    refetchInterval: 10_000,
  });
  const pendingCount = approvals.length;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border-subtle bg-surface-base/95 backdrop-blur-sm safe-bottom">
      <div className="flex items-center justify-around py-1.5 px-1">
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
                'relative flex flex-col items-center gap-0.5 px-2 py-1.5 min-w-[52px] rounded-md transition-colors',
                active ? 'text-accent' : 'text-text-muted',
              )}
            >
              <item.Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {item.href === '/dashboard/approvals' && pendingCount > 0 && (
                <span className="absolute -top-0.5 right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-status-error px-1 text-[9px] font-bold text-white">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
