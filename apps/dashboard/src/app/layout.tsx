import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import { VibeKanbanWrapper } from '@/components/vibe-kanban-wrapper';
import './globals.css';

export const metadata: Metadata = {
  title: 'Liteshow - Developer-First CMS',
  description: 'Developer-First, SEO-Optimized, Git-Powered CMS',
  icons: {
    icon: [
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    shortcut: '/favicon.ico',
    apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
  },
  manifest: '/site.webmanifest',
  appleWebApp: {
    title: 'Liteshow',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <VibeKanbanWrapper />
        {children}
        <Toaster
          position="top-right"
          expand={true}
          richColors
          closeButton
        />
      </body>
    </html>
  );
}
