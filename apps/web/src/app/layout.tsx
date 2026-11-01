import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/lib/providers/query-provider';
import { AuthProvider } from '@/lib/providers/auth-provider';
import { WsProvider } from '@/lib/providers/ws-provider';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: '#0a0a0b',
};

export const metadata: Metadata = {
  title: 'DeOrch',
  description: 'Developer Orchestration Hub — Control your AI coding agents from anywhere',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'DeOrch',
  },
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/icon.svg',
  },
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
