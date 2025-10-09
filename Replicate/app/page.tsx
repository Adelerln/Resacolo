'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface GenerationState {
  status: 'idle' | 'loading' | 'error' | 'success';
  message?: string;
}

export default function HomePage() {
  const [prompt, setPrompt] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [state, setState] = useState<GenerationState>({ status: 'idle' });

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setResultUrl(null);

    setPreviewUrl((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }
      return file ? URL.createObjectURL(file) : null;
    });
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setResultUrl(null);

      if (!selectedFile) {
        setState({ status: 'error', message: 'Veuillez ajouter une image à transformer.' });
        return;
      }

      if (!prompt.trim()) {
        setState({ status: 'error', message: 'Décrivez la transformation souhaitée dans le champ texte.' });
        return;
      }

      setState({ status: 'loading', message: 'Génération en cours… Cette étape peut prendre quelques secondes.' });

      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('prompt', prompt.trim());

      try {
        const response = await fetch('/api/generate', {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorJson = await response.json().catch(() => ({}));
          throw new Error(errorJson?.message || 'Une erreur est survenue durant la génération.');
        }

        const data = (await response.json()) as { imageUrl: string };
        setResultUrl(data.imageUrl);
        setState({ status: 'success', message: 'Transformation terminée avec succès.' });
      } catch (error) {
        console.error(error);
        setState({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Impossible de finaliser la génération. Vérifiez votre connexion et réessayez.'
        });
      }
    },
    [prompt, selectedFile]
  );

  const isSubmitting = state.status === 'loading';

  const statusTone = useMemo(() => {
    switch (state.status) {
      case 'error':
        return '#ef4444';
      case 'success':
        return '#0ea5e9';
      case 'loading':
        return '#6366f1';
      default:
        return '#1f2937';
    }
  }, [state.status]);

  return (
    <main style={styles.wrapper}>
      <section style={styles.hero}>
        <h1 style={styles.title}>Studio IA Resacolo</h1>
        <p style={styles.subtitle}>
          Téléchargez une image, écrivez un prompt créatif et laissez notre pipeline IA propulsée par Replicate donner
          vie à vos idées.
        </p>
      </section>

      <section style={styles.content}>
        <form style={styles.form} onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.label}>Image d’origine</label>
            <label htmlFor="image-input" style={styles.dropzone}>
              <input
                id="image-input"
                type="file"
                name="image"
                accept="image/png,image/jpeg,image/webp"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              {previewUrl ? (
                <img src={previewUrl} alt="Aperçu du fichier sélectionné" style={styles.preview} />
              ) : (
                <span style={{ color: '#64748b' }}>
                  Glissez-déposez une image ou cliquez pour parcourir vos fichiers (PNG, JPG ou WEBP)
                </span>
              )}
            </label>
          </div>

          <div style={styles.field}>
            <label htmlFor="prompt" style={styles.label}>
              Prompt de transformation
            </label>
            <textarea
              id="prompt"
              name="prompt"
              rows={4}
              placeholder="Exemple : Crée une version illustrée façon aquarelle avec des couleurs pastel éclatantes."
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              style={styles.textarea}
            />
          </div>

          <button type="submit" style={{ ...styles.button, opacity: isSubmitting ? 0.7 : 1 }} disabled={isSubmitting}>
            {isSubmitting ? 'Génération en cours…' : 'Générer'}
          </button>

          {state.message && (
            <p style={{ ...styles.statusMessage, color: statusTone }}>
              {state.status === 'loading' && <span className="loader" />}
              {state.message}
            </p>
          )}
        </form>

        <section style={styles.resultCard}>
          <h2 style={styles.resultTitle}>Résultat</h2>
          <p style={styles.resultDescription}>
            L’image générée s’affiche ici après traitement. Elle est également sauvegardée dans Supabase (&nbsp;
            <code style={styles.code}>output-images</code> &nbsp;) et référencée dans la table{' '}
            <code style={styles.code}>projects</code>.
          </p>
          <div style={styles.resultPreview}>
            {resultUrl ? (
              <img src={resultUrl} alt="Image générée" style={styles.generatedImage} />
            ) : (
              <span style={{ color: '#94a3b8' }}>Aucun rendu généré pour le moment.</span>
            )}
          </div>
        </section>
      </section>

      <style jsx>{`
        .loader {
          display: inline-block;
          width: 1rem;
          height: 1rem;
          border-radius: 9999px;
          border: 2px solid rgba(99, 102, 241, 0.3);
          border-top-color: rgba(99, 102, 241, 1);
          margin-right: 0.5rem;
          animation: spin 1s linear infinite;
          vertical-align: middle;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '48px 24px',
    gap: '32px'
  },
  hero: {
    maxWidth: 720,
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  title: {
    fontFamily: "'Manrope', 'Inter', sans-serif",
    fontSize: '2.8rem',
    fontWeight: 700,
    letterSpacing: '-0.04em',
    margin: 0
  },
  subtitle: {
    fontSize: '1.05rem',
    lineHeight: 1.6,
    color: '#475569',
    margin: 0
  },
  content: {
    width: '100%',
    maxWidth: 1100,
    display: 'grid',
    gap: '32px',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    alignItems: 'start'
  },
  form: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(6px)',
    borderRadius: '24px',
    padding: '32px',
    boxShadow: '0 25px 60px -40px rgba(15, 23, 42, 0.45)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  label: {
    fontSize: '0.9rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: '#1f2937'
  },
  dropzone: {
    border: '2px dashed rgba(99, 102, 241, 0.4)',
    borderRadius: '20px',
    padding: '26px 20px',
    minHeight: '220px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    fontSize: '0.95rem',
    lineHeight: 1.5,
    cursor: 'pointer',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    transition: 'border-color 0.2s ease, transform 0.2s ease'
  },
  preview: {
    maxWidth: '100%',
    maxHeight: '320px',
    borderRadius: '18px',
    objectFit: 'cover',
    boxShadow: '0 16px 35px -24px rgba(99, 102, 241, 0.6)'
  },
  textarea: {
    borderRadius: '18px',
    border: '1px solid rgba(148, 163, 184, 0.5)',
    padding: '16px 18px',
    fontSize: '0.95rem',
    lineHeight: 1.5,
    resize: 'vertical',
    minHeight: '140px',
    outline: 'none',
    backgroundColor: 'rgba(255, 255, 255, 0.7)'
  },
  button: {
    borderRadius: '999px',
    border: 'none',
    padding: '14px 20px',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#fff',
    background: 'linear-gradient(135deg, #6366f1, #14b8a6)',
    cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    boxShadow: '0 20px 45px -30px rgba(99, 102, 241, 0.8)'
  },
  statusMessage: {
    fontSize: '0.9rem',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    margin: 0
  },
  resultCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(8px)',
    borderRadius: '24px',
    padding: '32px',
    boxShadow: '0 25px 60px -40px rgba(15, 23, 42, 0.45)',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px'
  },
  resultTitle: {
    margin: 0,
    fontSize: '1.6rem',
    fontFamily: "'Manrope', 'Inter', sans-serif",
    fontWeight: 700,
    color: '#111827'
  },
  resultDescription: {
    margin: 0,
    fontSize: '0.95rem',
    lineHeight: 1.6,
    color: '#475569'
  },
  resultPreview: {
    borderRadius: '20px',
    border: '1px dashed rgba(148, 163, 184, 0.4)',
    padding: '20px',
    minHeight: '320px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 250, 252, 0.7)'
  },
  generatedImage: {
    maxWidth: '100%',
    maxHeight: '360px',
    borderRadius: '16px',
    boxShadow: '0 16px 35px -24px rgba(14, 165, 233, 0.55)',
    objectFit: 'contain'
  },
  code: {
    padding: '2px 6px',
    borderRadius: '6px',
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    color: '#1d4ed8',
    fontSize: '0.8rem'
  }
};
