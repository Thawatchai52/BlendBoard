import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import Providers from '@/components/providers';

export const metadata: Metadata = { title: 'Content Calendar', description: 'ตารางคอนเทนต์ Kudsan · Bellinee\'s' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600&family=Prompt:wght@500;600&display=swap"
        />
      </head>
      <body className="min-h-screen bg-bg font-body text-fg antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
