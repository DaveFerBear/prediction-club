import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://0x1.club'),
  title: 'Prediction Club',
  description: 'Trade predictions and compete on-chain',
  openGraph: {
    title: 'Prediction Club',
    description: 'Trade predictions and compete on-chain',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'Prediction Club preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prediction Club',
    description: 'Trade predictions and compete on-chain',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
