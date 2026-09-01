import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://psip-monitor.sites.openai.com'),
  title: { default: 'PSIP Monitor', template: '%s | PSIP Monitor' },
  description: 'Public School Infrastructure Program monitoring dashboard',
  openGraph: { title: 'PSIP Monitor', description: 'School infrastructure, clearly monitored.', images: ['/og.png'] },
  twitter: { card: 'summary_large_image', title: 'PSIP Monitor', description: 'School infrastructure, clearly monitored.', images: ['/og.png'] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
