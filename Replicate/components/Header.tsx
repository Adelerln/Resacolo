'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useCallback, useState } from 'react';

export function Header() {
  const { user, signOut, loading } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    const { error } = await signOut();
    setSigningOut(false);
    if (error) {
      console.error('[signOut] error', error);
    }
    router.replace('/');
  }, [router, signOut]);

  const showAuthLinks = !loading && !user && pathname !== '/signup';

  return (
    <header style={styles.wrapper}>
      <Link href="/" style={styles.brand}>
        Studio IA Photo
      </Link>

      <nav style={styles.nav}>
        {user ? (
          <div style={styles.session}>
            <span style={styles.email}>{user.email}</span>
            <button onClick={handleSignOut} style={styles.signOut} disabled={signingOut}>
              {signingOut ? 'Déconnexion…' : 'Déconnexion'}
            </button>
          </div>
        ) : (
          showAuthLinks && (
            <div style={styles.links}>
              <Link href="/login" style={styles.link}>
                Connexion
              </Link>
              <Link href="/signup" style={{ ...styles.link, ...styles.cta }}>
                Inscription
              </Link>
            </div>
          )
        )}
      </nav>
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 32px',
    position: 'sticky',
    top: 0,
    background: 'rgba(255,255,255,0.8)',
    backdropFilter: 'blur(12px)',
    borderBottom: '1px solid rgba(148,163,184,0.25)',
    zIndex: 10
  },
  brand: {
    fontWeight: 700,
    fontSize: '1.2rem',
    letterSpacing: '0.05em'
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  links: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  link: {
    fontWeight: 600,
    padding: '8px 14px',
    borderRadius: '999px',
    border: '1px solid rgba(99,102,241,0.4)'
  },
  cta: {
    background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
    color: '#fff',
    border: 'none'
  },
  session: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  email: {
    fontWeight: 500,
    color: '#1f2937'
  },
  signOut: {
    borderRadius: '999px',
    border: '1px solid rgba(239,68,68,0.4)',
    padding: '8px 16px',
    backgroundColor: '#fff',
    fontWeight: 600,
    color: '#ef4444',
    cursor: 'pointer'
  }
};
