import type { Metadata } from 'next';
import { Geist, Geist_Mono, Inter } from 'next/font/google';
import './globals.css';
import { cn } from '@/lib/utils';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

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
  title: { default: 'PPP Dashboard', template: '%s | PPP Dashboard' },
  description: 'Public School Infrastructure Program monitoring dashboard',
  openGraph: {
    title: 'PPP Dashboard',
    description: 'School infrastructure, clearly monitored.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PPP Dashboard',
    description: 'School infrastructure, clearly monitored.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-motion="full"
      suppressHydrationWarning
      className={cn('font-sans', inter.variable)}
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var q=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)');var n=navigator;var c=Number(n.hardwareConcurrency)||0;var m=Number(n.deviceMemory)||0;var s=!!(n.connection&&n.connection.saveData);var l=s||c>0&&c<=2||m>0&&m<=2||(c>0&&c<=4&&m>0&&m<=4);var a=function(){document.documentElement.dataset.motion=q&&q.matches?'reduced':l?'lite':'full'};a();if(q){q.addEventListener?q.addEventListener('change',a):q.addListener&&q.addListener(a)}}catch(e){document.documentElement.dataset.motion='full'}})();`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
