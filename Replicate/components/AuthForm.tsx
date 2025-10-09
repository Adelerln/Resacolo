'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

type AuthMode = 'login' | 'signup';

interface AuthFormProps {
  initialMode?: AuthMode;
}

interface FormState {
  email: string;
  password: string;
}

export function AuthForm({ initialMode = 'login' }: AuthFormProps) {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [form, setForm] = useState<FormState>({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = useMemo(() => searchParams.get('redirectedFrom') ?? '/dashboard', [searchParams]);

  const handleModeChange = useCallback(
    (nextMode: AuthMode) => {
      setMode(nextMode);
      setError(null);
      setSuccess(null);
    },
    [setMode]
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = event.target;
      setForm((previous) => ({
        ...previous,
        [name]: value
      }));
      setError(null);
    },
    [setForm]
  );

  const validate = useCallback((): string | null => {
    const emailPattern = /\S+@\S+\.\S+/;
    if (!emailPattern.test(form.email)) {
      return 'Veuillez saisir une adresse email valide.';
    }
    if (form.password.length < 8) {
      return 'Le mot de passe doit contenir au moins 8 caractères.';
    }
    return null;
  }, [form.email, form.password]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setError(null);
      setSuccess(null);

      const validationError = validate();
      if (validationError) {
        setError(validationError);
        return;
      }

      setSubmitting(true);
      const credentials = { email: form.email.trim(), password: form.password };

      if (mode === 'login') {
        const { error } = await signIn(credentials);
        if (error) {
          setError(error.message);
          setSubmitting(false);
          return;
        }
        router.replace(redirectTo);
        return;
      }

      const { error, data } = await signUp(credentials);
      if (error) {
        setError(error.message);
        setSubmitting(false);
        return;
      }

      if (!data.session) {
        setSuccess(
          'Inscription réussie ! Vérifiez vos emails pour confirmer votre compte.'
        );
        setSubmitting(false);
        return;
      }

      router.replace(redirectTo);
    },
    [form.email, form.password, mode, redirectTo, router, signIn, signUp, validate]
  );

  return (
    <div style={styles.card}>
      <div style={styles.tabs}>
        <button
          type="button"
          onClick={() => handleModeChange('login')}
          style={{
            ...styles.tab,
            backgroundColor: mode === 'login' ? '#0ea5e9' : 'transparent',
            color: mode === 'login' ? '#fff' : '#0f172a'
          }}
          disabled={submitting}
        >
          Connexion
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('signup')}
          style={{
            ...styles.tab,
            backgroundColor: mode === 'signup' ? '#0ea5e9' : 'transparent',
            color: mode === 'signup' ? '#fff' : '#0f172a'
          }}
          disabled={submitting}
        >
          Inscription
        </button>
      </div>

      <form style={styles.form} onSubmit={handleSubmit} noValidate>
        <div style={styles.field}>
          <label style={styles.label} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleInputChange}
            style={styles.input}
            placeholder="votre@email.com"
            disabled={submitting}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.label} htmlFor="password">
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={form.password}
            onChange={handleInputChange}
            style={styles.input}
            placeholder="********"
            disabled={submitting}
          />
        </div>

        {error && <p style={{ ...styles.feedback, color: '#ef4444' }}>{error}</p>}
        {success && <p style={{ ...styles.feedback, color: '#16a34a' }}>{success}</p>}

        <button type="submit" style={styles.submit} disabled={submitting}>
          {submitting ? 'Chargement…' : mode === 'login' ? 'Se connecter' : "S'inscrire"}
        </button>
      </form>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    maxWidth: 420,
    width: '100%',
    padding: '32px',
    borderRadius: '24px',
    boxShadow: '0 25px 60px -40px rgba(15, 23, 42, 0.45)',
    backgroundColor: 'rgba(255,255,255,0.95)',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  tabs: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    backgroundColor: 'rgba(148, 163, 184, 0.15)',
    borderRadius: '16px',
    padding: '6px'
  },
  tab: {
    border: 'none',
    borderRadius: '12px',
    padding: '12px 16px',
    fontWeight: 600,
    fontSize: '1rem',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease, color 0.2s ease'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    fontWeight: 600,
    fontSize: '0.9rem',
    color: '#0f172a'
  },
  input: {
    borderRadius: '14px',
    border: '1px solid rgba(148,163,184,0.5)',
    padding: '14px 16px',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s ease'
  },
  submit: {
    borderRadius: '12px',
    border: 'none',
    padding: '14px 16px',
    fontSize: '1rem',
    fontWeight: 600,
    color: '#fff',
    background: 'linear-gradient(135deg, #6366f1, #0ea5e9)',
    cursor: 'pointer',
    boxShadow: '0 20px 45px -30px rgba(14, 165, 233, 0.8)'
  },
  feedback: {
    margin: 0,
    fontSize: '0.9rem',
    lineHeight: 1.4
  }
};
