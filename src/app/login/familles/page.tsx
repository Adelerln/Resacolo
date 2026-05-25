import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Connexion familles | Resacolo'
};

export default async function FamilyLoginPage({
  searchParams
}: {
  searchParams?: Promise<{ redirectTo?: string; registered?: string; error?: string }>;
}) {
  if (process.env.MOCK_UI === '1') {
    return null;
  }

  const { redirectTo, registered, error } = searchParams ? await searchParams : {};
  const url = new URL('/login', 'http://local');
  url.searchParams.set('mode', 'family');
  if (redirectTo) url.searchParams.set('redirectTo', redirectTo);
  if (registered) url.searchParams.set('registered', registered);
  if (error) url.searchParams.set('error', error);
  redirect(`${url.pathname}?${url.searchParams.toString()}`);
}
