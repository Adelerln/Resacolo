import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Connexion organisateur | Resacolo'
};

export default async function OrganizerLoginPage({
  searchParams
}: {
  searchParams?: Promise<{ redirectTo?: string; error?: string }>;
}) {
  if (process.env.MOCK_UI === '1') {
    return null;
  }

  const { redirectTo, error } = searchParams ? await searchParams : {};
  const url = new URL('/login', 'http://local');
  url.searchParams.set('mode', 'pro');
  if (redirectTo) url.searchParams.set('redirectTo', redirectTo);
  if (error) url.searchParams.set('error', error);
  redirect(`${url.pathname}?${url.searchParams.toString()}`);
}
