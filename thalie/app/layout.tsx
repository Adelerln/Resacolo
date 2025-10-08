import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Thalie Analytics',
  description: 'Dashboard de suivi alimenté par Supabase.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
