import { redirect } from 'next/navigation';

/** Ancienne étape « Participants » : désormais sur la page informations. */
export default function CheckoutParticipantsPage() {
  redirect('/checkout/informations');
}
