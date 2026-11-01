'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/providers/auth-provider';
import { useWs } from '@/lib/providers/ws-provider';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { cn } from '@/lib/utils/cn';
import { registerServiceWorker } from '@/lib/sw-register';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, logout } = useAuth();
  const { isConnected } = useWs();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [isAuthenticated, router]);

  // Register service worker on mount
  useEffect(() => {
    void registerServiceWorker();
  }, []);

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-dvh overflow-hidden safe-top">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border-subtle">
          <div className="flex items-center gap-2 md:hidden">
            <h2 className="text-sm font-semibold">DeOrch</h2>
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                isConnected ? 'bg-status-success' : 'bg-status-error',
              )}
            />
          </div>
          <button
            onClick={logout}
            className="ml-auto text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Sign out
          </button>
        </div>
        <div className="px-4 md:px-6 py-4 md:py-6">
          {children}
        </div>
      </main>
      <MobileNav />
    </div>
  );
}
