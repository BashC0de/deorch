import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/lib/providers/query-provider';
import { AuthProvider } from '@/lib/providers/auth-provider';
import { WsProvider } from '@/lib/providers/ws-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'DeOrch',
  description: 'Developer Orchestration Hub — Control your AI coding agents from anywhere',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-surface-base text-text-primary min-h-screen antialiased`}>
        <QueryProvider>
          <AuthProvider>
            <WsProvider>
              {children}
            </WsProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
