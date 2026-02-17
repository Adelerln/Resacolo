import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact | ResaColo',
  description:
    'Contactez un organisateur ou l\'assistance ResaColo pour toute question sur les colonies de vacances.'
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
