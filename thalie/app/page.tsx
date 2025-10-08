import Link from 'next/link';
import styles from './page.module.css';

const programs = [
  {
    season: 'Été 2025',
    title: 'Comédie musicale & chant',
    ages: '8 — 12 ans',
    duration: '2 semaines · Bord de mer',
    description:
      'Exploration du jeu scénique, voix et chorégraphies originales, avec un spectacle final ouvert aux familles.',
  },
  {
    season: 'Été 2025',
    title: 'Cinéma & narration visuelle',
    ages: '11 — 15 ans',
    duration: '10 jours · Pyrénées',
    description:
      'Ateliers écriture, cadrage et montage pour réaliser un court-métrage collectif accompagné par des pros.',
  },
  {
    season: 'Toussaint',
    title: 'Arts plastiques immersifs',
    ages: '7 — 11 ans',
    duration: '1 semaine · Drôme provençale',
    description:
      'Peinture grand format, land art et parcours sensoriels pour développer imagination et confiance en soi.',
  },
];

const highlights = [
  {
    title: 'Encadrement d’artistes',
    detail:
      'Comédiens, réalisateurs, chefs de chœur et plasticiens diplômés guident chaque petit groupe de 8 enfants.',
  },
  {
    title: 'Immersion en nature',
    detail:
      'Maisons d’hôtes privatisées, ateliers en plein air et veillées sous les étoiles pour nourrir l’inspiration.',
  },
  {
    title: 'Restitution festive',
    detail:
      'Chaque séjour se conclut par une représentation ou exposition filmée que vous recevez à la maison.',
  },
  {
    title: 'Suivi bienveillant',
    detail:
      'Équipe pédagogique formée à la vie collective, présence infirmière et journal quotidien pour les parents.',
  },
];

const schedule = [
  {
    time: 'Matin',
    title: 'Atelier cœur de discipline',
    summary: 'Échauffements ludiques puis sessions encadrées (théâtre, voix, caméra ou arts visuels).',
  },
  {
    time: 'Après-midi',
    title: 'Explorations et créations',
    summary: 'Balades-inspiration, répétitions en petits groupes, tournages en extérieur, improvisations.',
  },
  {
    time: 'Soirée',
    title: 'Veillées enchantées',
    summary: 'Jam session, projection cinéma en plein air, scènes ouvertes autour du feu.',
  },
];

const testimonials = [
  {
    quote:
      'Maël a monté sur scène avec une assurance incroyable. L’équipe Thalie lui a donné envie de poursuivre le théâtre à l’année !',
    author: 'Sandrine, maman de Maël (10 ans)',
  },
  {
    quote:
      'Les enfants découvrent le cinéma autrement : ils écrivent, tournent, montent. On ressent un vrai esprit de troupe.',
    author: 'Julien, papa de Zoé (13 ans)',
  },
  {
    quote:
      'Un séjour où l’art côtoie la nature. Emma est revenue pleine d’étoiles et d’amis.',
    author: 'Nadia, maman d’Emma (9 ans)',
  },
];

export default function HomePage() {
  return (
    <main className={styles.home}>
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.heroPill}>Colonie artistique Thalie</span>
          <h1 className={styles.heroTitle}>
            Des vacances pour <span>créer</span>, rêver et monter sur scène.
          </h1>
          <p className={styles.heroSubtitle}>
            Thalie imagine des colonies de vacances artistiques où chaque enfant explore le théâtre, le chant,
            le cinéma ou les arts plastiques au cœur de lieux inspirants.
          </p>
          <div className={styles.heroActions}>
            <Link href="/dashboard" className={styles.heroPrimary}>
              Suivre les demandes des familles
            </Link>
            <a href="#programmes" className={styles.heroSecondary}>
              Voir les séjours 2025
            </a>
          </div>
        </div>
      </header>

      <section id="programmes" className={styles.programSection}>
        <div className={styles.sectionHeading}>
          <h2>Nos séjours artistiques</h2>
          <p>
            Des formats sur mesure par tranche d’âge, pensés pour révéler les talents et encourager la confiance
            en soi dans un cadre sécurisé.
          </p>
        </div>
        <div className={styles.programGrid}>
          {programs.map((program) => (
            <article key={program.title} className={styles.programCard}>
              <div className={styles.programMeta}>
                <span>📅 {program.season}</span>
                <span>👫 {program.ages}</span>
                <span>📍 {program.duration}</span>
              </div>
              <h3>{program.title}</h3>
              <p>{program.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.highlightSection}>
        <div className={styles.sectionHeading}>
          <h2>L’expérience Thalie</h2>
          <p>
            Un accompagnement artistique complet, des petits groupes et une attention particulière portée au
            bien-être.
          </p>
        </div>
        <div className={styles.highlightGrid}>
          {highlights.map((highlight) => (
            <article key={highlight.title} className={styles.highlightCard}>
              <h3>{highlight.title}</h3>
              <p>{highlight.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.scheduleSection}>
        <div className={styles.sectionHeading}>
          <h2>Une journée type</h2>
          <p>
            Des rythmes doux, des temps calmes et des ateliers progressifs pour que chaque enfant ose
            s’exprimer.
          </p>
        </div>
        <div className={styles.scheduleGrid}>
          {schedule.map((slot) => (
            <article key={slot.time} className={styles.scheduleCard}>
              <span>{slot.time}</span>
              <h3>{slot.title}</h3>
              <p>{slot.summary}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.testimonialSection}>
        <div className={styles.sectionHeading}>
          <h2>Ils racontent leurs souvenirs</h2>
          <p>Parents et jeunes partagent les moments forts vécus pendant nos stages artistiques.</p>
        </div>
        <div className={styles.testimonialGrid}>
          {testimonials.map((testimonial) => (
            <figure key={testimonial.author} className={styles.testimonialCard}>
              <blockquote>“{testimonial.quote}”</blockquote>
              <figcaption>{testimonial.author}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.ctaContent}>
          <h2>Parlons du prochain séjour de votre enfant</h2>
          <p>
            Réservez un échange avec notre équipe pédagogique pour choisir le programme le plus adapté à ses
            envies.
          </p>
        </div>
        <a className={styles.heroPrimary} href="mailto:contact@thalie-colonies.fr">
          Je prends rendez-vous
        </a>
      </section>
    </main>
  );
}
