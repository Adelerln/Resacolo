import type { Metadata } from 'next';
import { CheckoutProvider } from '@/context/CheckoutContext';

export const metadata: Metadata = {
  title: 'Checkout | Resacolo',
  description: 'Finalisez votre panier en quelques étapes.'
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return <CheckoutProvider>{children}</CheckoutProvider>;
}
