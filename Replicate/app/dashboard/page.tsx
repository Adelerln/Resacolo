'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface Project {
  id: string;
  prompt: string;
  status: string | null;
  input_image_url: string | null;
  output_image_url: string | null;
  created_at: string;
}

type GenerationStatus = 'idle' | 'loading' | 'success' | 'error';

export default function DashboardPage() {
  const { supabase, user, loading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<{ state: GenerationStatus; message?: string }>({ state: 'idle' });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, router, user]);

  const loadProjects = useCallback(async () => {
    setProjectsError(null);
    setLoadingProjects(true);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setProjectsError('Impossible de récupérer vos projets pour le moment.');
    } else {
      setProjects(data ?? []);
    }
    setLoadingProjects(false);
  }, [supabase]);

  useEffect(() => {
    if (!loading && user) {
      loadProjects();
    }
  }, [loadProjects, loading, user]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;

    setFile(nextFile);
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return nextFile ? URL.createObjectURL(nextFile) : null;
    });
    setStatus({ state: 'idle' });
  }, []);

  const canSubmit = useMemo(() => file && prompt.trim().length > 0, [file, prompt]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!file) {
        setStatus({ state: 'error', message: 'Sélectionnez une image à transformer.' });
        return;
      }
      if (!prompt.trim()) {
        setStatus({ state: 'error', message: 'Décrivez le rendu souhaité dans le champ texte.' });
        return;
      }

      setStatus({ state: 'loading', message: 'Génération en cours…' });

      try {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('prompt', prompt.trim());

        const response = await fetch('/api/generate', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          throw new Error(errorPayload?.message ?? 'La génération a échoué.');
        }

        setPrompt('');
        setFile(null);
        setPreviewUrl((current) => {
          if (current) {
            URL.revokeObjectURL(current);
          }
          return null;
        });

        setStatus({ state: 'success', message: 'Image générée avec succès.' });
        await loadProjects();
      } catch (error) {
        console.error('[generate] error', error);
        setStatus({
          state: 'error',
          message: error instanceof Error ? error.message : 'Une erreur inconnue est survenue.'
        });
      }
    },
    [file, loadProjects, prompt]
  );

  const handleDelete = useCallback(
    async (projectId: string) => {
      setDeletingId(projectId);
      try {
        const response = await fetch('/api/delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ id: projectId })
        });

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => ({}));
          throw new Error(errorPayload?.message ?? 'La suppression a échoué.');
        }

        setProjects((current) => current.filter((project) => project.id !== projectId));
      } catch (error) {
        console.error('[delete] error', error);
        setStatus({
          state: 'error',
          message: error instanceof Error ? error.message : 'Impossible de supprimer ce projet.'
        });
      } finally {
        setDeletingId(null);
      }
    },
    []
  );

  return (
    <div style={styles.layout}>
      <section style={styles.panel}>
        <h1 style={styles.title}>Nouvelle génération</h1>
        <form style={styles.form} onSubmit={handleSubmit}>
          <label htmlFor="file" style={styles.label}>
            Image source
          </label>
          <label htmlFor="file" style={styles.dropzone}>
            <input
              id="file"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            {previewUrl ? (
              <img src={previewUrl} alt="Prévisualisation" style={styles.preview} />
            ) : (
              <span style={{ color: '#64748b' }}>
                Glissez-déposez une image ou cliquez pour parcourir vos fichiers.
              </span>
            )}
          </label>

          <label htmlFor="prompt" style={styles.label}>
            Prompt
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            style={styles.textarea}
            rows={4}
            placeholder="Décrivez précisément votre rendu final."
          />

          {status.state !== 'idle' && (
            <p
              style={{
                ...styles.feedback,
                color:
                  status.state === 'error'
                    ? '#ef4444'
                    : status.state === 'success'
                    ? '#16a34a'
                    : '#0ea5e9'
              }}
            >
              {status.message}
            </p>
          )}

          <button type="submit" style={styles.submit} disabled={!canSubmit || status.state === 'loading'}>
            {status.state === 'loading' ? 'Génération…' : 'Lancer la génération'}
          </button>
        </form>
      </section>

      <section style={styles.gallery}>
        <h2 style={styles.galleryTitle}>Mes projets</h2>
        {loadingProjects ? (
          <p style={styles.empty}>Chargement en cours…</p>
        ) : projectsError ? (
          <p style={{ ...styles.empty, color: '#ef4444' }}>{projectsError}</p>
        ) : projects.length === 0 ? (
          <p style={styles.empty}>Aucun projet pour le moment. Lancez votre première génération !</p>
        ) : (
          <div style={styles.cards}>
            {projects.map((project) => (
              <article key={project.id} style={styles.card}>
                <div style={styles.images}>
                  {project.input_image_url && (
                    <img src={project.input_image_url} alt="Image d'origine" style={styles.image} />
                  )}
                  {project.output_image_url && (
                    <img src={project.output_image_url} alt="Résultat IA" style={styles.image} />
                  )}
                </div>
                <p style={styles.prompt}>{project.prompt}</p>
                <div style={styles.cardFooter}>
                  <time style={styles.time}>
                    {new Date(project.created_at).toLocaleString('fr-FR', {
                      dateStyle: 'short',
                      timeStyle: 'short'
                    })}
                  </time>
                  <button
                    onClick={() => handleDelete(project.id)}
                    style={styles.delete}
                    disabled={deletingId === project.id}
                  >
                    {deletingId === project.id ? 'Suppression…' : 'Supprimer'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  layout: {
    flex: 1,
    display: 'grid',
    gap: '32px',
    gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))',
    padding: '40px clamp(16px, 4vw, 48px)'
  },
  panel: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: '24px',
    padding: '32px',
    boxShadow: '0 25px 60px -40px rgba(15, 23, 42, 0.45)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  title: {
    margin: 0,
    fontSize: '1.8rem',
    fontWeight: 700,
    color: '#0f172a'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  label: {
    fontWeight: 600,
    fontSize: '0.9rem',
    letterSpacing: '0.06em',
    color: '#1f2937'
  },
  dropzone: {
    border: '2px dashed rgba(99, 102, 241, 0.4)',
    borderRadius: '20px',
    padding: '20px',
    minHeight: '200px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    backgroundColor: 'rgba(248, 250, 252, 0.7)'
  },
  preview: {
    maxWidth: '100%',
    maxHeight: '220px',
    borderRadius: '16px',
    objectFit: 'cover',
    boxShadow: '0 16px 35px -24px rgba(99, 102, 241, 0.6)'
  },
  textarea: {
    borderRadius: '16px',
    border: '1px solid rgba(148,163,184,0.5)',
    padding: '16px',
    resize: 'vertical',
    minHeight: '140px',
    fontSize: '0.95rem'
  },
  submit: {
    borderRadius: '999px',
    border: 'none',
    padding: '14px 18px',
    fontWeight: 600,
    fontSize: '1rem',
    color: '#fff',
    background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
    cursor: 'pointer'
  },
  feedback: {
    margin: 0,
    fontSize: '0.9rem',
    fontWeight: 500
  },
  gallery: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: '24px',
    padding: '32px',
    boxShadow: '0 25px 60px -40px rgba(15, 23, 42, 0.45)',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  galleryTitle: {
    margin: 0,
    fontSize: '1.6rem',
    fontWeight: 700,
    color: '#111827'
  },
  empty: {
    margin: 0,
    fontSize: '1rem',
    color: '#475569'
  },
  cards: {
    display: 'grid',
    gap: '20px'
  },
  card: {
    borderRadius: '20px',
    border: '1px solid rgba(148,163,184,0.3)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  images: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '12px'
  },
  image: {
    width: '100%',
    borderRadius: '16px',
    objectFit: 'cover',
    border: '1px solid rgba(148,163,184,0.3)'
  },
  prompt: {
    margin: 0,
    fontSize: '0.95rem',
    lineHeight: 1.5,
    color: '#1f2937'
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  time: {
    fontSize: '0.85rem',
    color: '#64748b'
  },
  delete: {
    borderRadius: '999px',
    border: '1px solid rgba(239,68,68,0.3)',
    padding: '8px 14px',
    backgroundColor: '#fff',
    color: '#ef4444',
    fontWeight: 600,
    cursor: 'pointer'
  }
};
