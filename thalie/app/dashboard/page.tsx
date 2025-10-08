import { createServerSupabaseClient } from '@/lib/supabase/server';
import styles from './dashboard.module.css';

type ContactRecord = {
  id: number;
  created_at: string;
  email: string | null;
  Name: string | null;
  role_etablissement: string | null;
  message: string | null;
  ages_eleves: string | null;
  localisation: string | null;
  matieres_enseignees: string | null;
};

function formatDate(dateIso: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(dateIso));
}

function toDisplay(value: string | null) {
  return value && value.trim().length > 0 ? value : '—';
}

export const revalidate = 0;

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from<ContactRecord>('AI_contacts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <main className={styles.page}>
        <section className={styles.panel}>
          <h1>Tableau de bord Thalie</h1>
          <p className={styles.error}>Impossible de charger les données : {error.message}</p>
        </section>
      </main>
    );
  }

  const rows = data ?? [];
  const total = rows.length;
  const uniqueRoles = new Set(
    rows.map((row) => row.role_etablissement?.trim()).filter(Boolean)
  ).size;
  const uniqueLocalisations = new Set(
    rows.map((row) => row.localisation?.trim()).filter(Boolean)
  ).size;
  const uniqueSubjects = new Set(
    rows.map((row) => row.matieres_enseignees?.trim()).filter(Boolean)
  ).size;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.pill}>Suivi des familles</span>
          <h1>Tableau de bord des inscriptions Thalie</h1>
          <p>
            Retrouvez les familles intéressées par nos colonies artistiques, identifiez leurs attentes et
            organisez vos rappels en un coup d’œil.
          </p>
        </div>
      </header>

      <section className={styles.summaryGrid}>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Contacts totaux</span>
          <strong className={styles.summaryValue}>{total}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Rôles distincts</span>
          <strong className={styles.summaryValue}>{uniqueRoles}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Localisations uniques</span>
          <strong className={styles.summaryValue}>{uniqueLocalisations}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Matières mentionnées</span>
          <strong className={styles.summaryValue}>{uniqueSubjects}</strong>
        </article>
      </section>

      <section className={styles.panel}>
        <header className={styles.panelHeader}>
          <div>
            <h2>Dernières prises de contact</h2>
            <p>Analysez les envies des enfants et adaptez vos propositions de séjours.</p>
          </div>
        </header>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Reçu le</th>
                <th>Nom / Email</th>
                <th>Rôle</th>
                <th>Âges élèves</th>
                <th>Localisation</th>
                <th>Matières</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.empty}>Aucun contact pour le moment.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.created_at)}</td>
                    <td>
                      <div className={styles.identity}>
                        <strong>{toDisplay(row.Name)}</strong>
                        <span>{toDisplay(row.email)}</span>
                      </div>
                    </td>
                    <td>{toDisplay(row.role_etablissement)}</td>
                    <td>{toDisplay(row.ages_eleves)}</td>
                    <td>{toDisplay(row.localisation)}</td>
                    <td>{toDisplay(row.matieres_enseignees)}</td>
                    <td>
                      <span className={styles.message}>{toDisplay(row.message)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
