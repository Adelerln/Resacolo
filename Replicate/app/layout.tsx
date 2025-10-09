import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'Resacolo Studio | IA Image Editor',
  description: 'Téléchargez une image, décrivez le rendu souhaité et laissez l’IA transformer votre visuel.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <AuthProvider>
          <Header />
          <main
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
