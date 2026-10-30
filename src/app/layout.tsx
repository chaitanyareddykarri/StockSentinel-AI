import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
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
  icons: {
    icon: '/images/stocksentinel-icon.png',
    apple: '/images/stocksentinel-icon.png',
  },
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
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-emerald-500/20 selection:text-emerald-900">
        <AuthProvider>{children}</AuthProvider>
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
