import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Panier | Resacolo',
  description: 'Vos séjours réservés sur Resacolo.'
};

export default function PanierLayout({ children }: { children: React.ReactNode }) {
  return children;
}
