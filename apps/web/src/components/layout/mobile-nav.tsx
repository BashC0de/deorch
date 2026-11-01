'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

const navItems = [
  { label: 'Home', href: '/dashboard', icon: '◉' },
  { label: 'Approvals', href: '/dashboard/approvals', icon: '◈' },
  { label: 'Sessions', href: '/dashboard/sessions', icon: '▸' },
  { label: 'Devices', href: '/dashboard/devices', icon: '⊞' },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border-subtle bg-surface-base/95 backdrop-blur-sm">
      <div className="flex items-center justify-around py-1.5">
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
                'flex flex-col items-center gap-0.5 px-3 py-1.5 min-w-[60px] rounded-md transition-colors',
                active ? 'text-accent' : 'text-text-muted',
              )}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
