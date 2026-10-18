import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'StockSentinel AI — Retail Inventory Intelligence Platform',
  description:
    'AI-powered retail inventory intelligence platform that detects potential phantom stock-outs, ranks suspicious SKU-store combinations, and manages physical shelf verifications.',
  keywords: [
    'phantom stock-out',
    'retail inventory',
    'out of stock',
    'inventory intelligence',
    'shelf walk',
    'retail AI',
  ],
  authors: [{ name: 'StockSentinel AI Team' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} dark h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#0a0e17] text-slate-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
