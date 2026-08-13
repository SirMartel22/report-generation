import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import InstallPrompt from '@/components/pwa/InstallPrompt';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'ReportApp | Multi-Tenant Offline-First SaaS Reporting',
  description: 'Robust operational reporting platform with offline PWA sync, AI audio transcription, and quarterly compilation.',
  manifest: '/manifest.json',
  themeColor: '#2563eb',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ReportApp',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased min-h-screen bg-[#090d16] text-slate-100 selection:bg-blue-600 selection:text-white`}>
        {children}
        <InstallPrompt />

        {/* Service Worker Registration Script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(registration) {
                      console.log('[PWA] Service Worker registered:', registration.scope);
                    },
                    function(err) {
                      console.warn('[PWA] Service Worker registration failed:', err);
                    }
                  );
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
