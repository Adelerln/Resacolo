'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

type SignInResult = Awaited<ReturnType<SupabaseClient['auth']['signInWithPassword']>>;
type SignUpResult = Awaited<ReturnType<SupabaseClient['auth']['signUp']>>;
type SignOutResult = Awaited<ReturnType<SupabaseClient['auth']['signOut']>>;

interface AuthContextValue {
  supabase: SupabaseClient;
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (credentials: { email: string; password: string }) => Promise<SignInResult>;
  signUp: (credentials: { email: string; password: string }) => Promise<SignUpResult>;
  signOut: () => Promise<SignOutResult>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initialise = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (isMounted) {
        if (!error) {
          setSession(data.session);
        }
        setLoading(false);
      }
    };

    initialise();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signIn = useCallback(
    async (credentials: { email: string; password: string }) => {
      return supabase.auth.signInWithPassword(credentials);
    },
    [supabase]
  );

  const signUp = useCallback(
    async (credentials: { email: string; password: string }) => {
      return supabase.auth.signUp(credentials);
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    return supabase.auth.signOut();
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      supabase,
      session,
      user: session?.user ?? null,
      loading,
      signIn,
      signUp,
      signOut
    }),
    [supabase, session, loading, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider.');
  }
  return context;
}
