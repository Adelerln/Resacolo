import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Resacolo Studio | IA Image Editor',
  description: 'Téléchargez une image, décrivez le rendu souhaité et laissez l’IA transformer votre visuel.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {children}
        </div>
      </body>
    </html>
  );
}
