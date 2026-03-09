import type { Metadata } from 'next';
import { BackOfficeShell } from '@/components/layout/BackOfficeShell';

export const metadata: Metadata = {
  title: 'Back Office partenaires | Resacolo',
  description:
    "L'interface de gestion pour créer, gérer et optimiser vos séjours."
};

export default function BackOfficeLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <BackOfficeShell>{children}</BackOfficeShell>;
}
