'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <main style={styles.wrapper}>
      <section style={styles.hero}>
        <span style={styles.badge}>Studio IA Photo</span>
        <h1 style={styles.title}>Créez vos visuels IA en quelques clics.</h1>
        <p style={styles.subtitle}>
          Déposez une photo, décrivez votre intention et laissez notre pipeline propulsée par Replicate générer
          l&apos;image parfaite. Gérez ensuite toutes vos créations, en toute sécurité, depuis votre tableau de bord.
        </p>
        <div style={styles.actions}>
          <Link href="/signup" style={{ ...styles.button, ...styles.primary }}>
            Commencer gratuitement
          </Link>
          <Link href="/login" style={{ ...styles.button, ...styles.secondary }}>
            Déjà inscrit ?
          </Link>
        </div>
      </section>

      <section style={styles.preview}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Protégez vos projets</h2>
          <p style={styles.cardText}>
            Chaque projet est lié à votre compte Supabase. Retrouvez vos prompts, comparez vos images avant/après et
            supprimez-les en un clic.
          </p>
          <div style={styles.snapshot}>
            <span style={styles.snapshotBadge}>Aperçu du dashboard</span>
            <div style={styles.snapshotGrid}>
              <div style={styles.placeholder}>
                <p style={styles.placeholderText}>Formulaire d&apos;upload</p>
              </div>
              <div style={{ ...styles.placeholder, background: 'rgba(236, 72, 153, 0.08)' }}>
                <p style={styles.placeholderText}>Galerie des projets</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '48px',
    padding: '80px clamp(24px, 5vw, 120px)'
  },
  hero: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  badge: {
    display: 'inline-flex',
    alignSelf: 'flex-start',
    padding: '6px 14px',
    borderRadius: '999px',
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    color: '#4338ca',
    fontWeight: 600,
    letterSpacing: '0.05em',
    fontSize: '0.85rem',
    textTransform: 'uppercase'
  },
  title: {
    margin: 0,
    fontSize: '3.5rem',
    lineHeight: 1.05,
    fontWeight: 700,
    color: '#0f172a'
  },
  subtitle: {
    margin: 0,
    fontSize: '1.1rem',
    lineHeight: 1.7,
    color: '#334155',
    maxWidth: 520
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px'
  },
  button: {
    padding: '14px 24px',
    borderRadius: '999px',
    fontWeight: 600,
    border: '1px solid transparent'
  },
  primary: {
    background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
    color: '#fff',
    boxShadow: '0 20px 45px -30px rgba(14, 165, 233, 0.8)'
  },
  secondary: {
    borderColor: 'rgba(99,102,241,0.4)',
    color: '#4f46e5',
    backgroundColor: 'rgba(99,102,241,0.08)'
  },
  preview: {
    display: 'flex',
    alignItems: 'center'
  },
  card: {
    width: '100%',
    padding: '32px',
    borderRadius: '24px',
    backgroundColor: 'rgba(255,255,255,0.9)',
    boxShadow: '0 25px 60px -40px rgba(15, 23, 42, 0.45)',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  cardTitle: {
    margin: 0,
    fontSize: '1.6rem',
    fontWeight: 700,
    color: '#111827'
  },
  cardText: {
    margin: 0,
    fontSize: '1rem',
    lineHeight: 1.6,
    color: '#475569'
  },
  snapshot: {
    borderRadius: '18px',
    border: '1px solid rgba(148,163,184,0.35)',
    padding: '16px',
    background: 'rgba(248, 250, 252, 0.85)',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px'
  },
  snapshotBadge: {
    alignSelf: 'flex-start',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#1d4ed8',
    padding: '6px 12px',
    borderRadius: '999px',
    backgroundColor: 'rgba(59,130,246,0.12)'
  },
  snapshotGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px'
  },
  placeholder: {
    borderRadius: '16px',
    border: '1px dashed rgba(148,163,184,0.5)',
    background: 'rgba(59,130,246, 0.08)',
    minHeight: '140px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center'
  },
  placeholderText: {
    fontWeight: 600,
    color: '#2563eb'
  }
};
