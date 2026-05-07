import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { UserProfile } from './types';

type AuthContextType = {
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  profile: null,
  isLoading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

function withTimeout<T>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

async function loadProfile(userId: string) {
  const { data, error } = await withTimeout(
    supabase
      .from('user_profile')
      .select('id, role, landlord_id, tenant_id, is_active, push_token, created_at')
      .eq('id', userId)
      .single(),
    10000,
    'Loading your account profile took too long. Please try again.'
  );

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const authRunRef = useRef(0);

  const applySession = useCallback(async (nextSession: Session | null) => {
    const runId = authRunRef.current + 1;
    authRunRef.current = runId;
    setSession(nextSession);

    if (!nextSession) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const nextProfile = await loadProfile(nextSession.user.id);
      if (authRunRef.current !== runId) return;
      setProfile(nextProfile);
    } catch (error) {
      console.warn('[auth] profile load failed:', error);
      if (authRunRef.current !== runId) return;
      setProfile(null);
    } finally {
      if (authRunRef.current === runId) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let disposed = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (event === 'INITIAL_SESSION') return;
        setTimeout(() => {
          if (!disposed) void applySession(nextSession);
        }, 0);
      }
    );

    void (async () => {
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          10000,
          'Restoring your session took too long. Please reload and try again.'
        );
        if (error) throw error;
        if (!disposed) await applySession(data.session);
      } catch (error) {
        console.warn('[auth] session restore failed:', error);
        if (!disposed) {
          setSession(null);
          setProfile(null);
          setIsLoading(false);
        }
      }
    })();

    return () => {
      disposed = true;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const refreshProfile = useCallback(async () => {
    const { data: { user }, error } = await withTimeout(
      supabase.auth.getUser(),
      10000,
      'Checking your account took too long. Please try again.'
    );
    if (error) throw error;
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    const nextProfile = await loadProfile(user.id);
    setProfile(nextProfile);
    setIsLoading(false);
  }, []);

  const signOut = useCallback(async () => {
    setProfile(null);
    await withTimeout(
      supabase.auth.signOut(),
      10000,
      'Signing out took too long. Please try again.'
    );
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, isLoading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
