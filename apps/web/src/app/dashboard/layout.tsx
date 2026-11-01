'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/providers/auth-provider';
import { Sidebar } from '@/components/layout/sidebar';
import { MobileNav } from '@/components/layout/mobile-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-border-subtle">
          <h2 className="text-sm font-semibold md:hidden">DeOrch</h2>
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
