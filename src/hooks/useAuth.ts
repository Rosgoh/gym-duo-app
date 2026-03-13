import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { signIn, signUp, signOut, getProfile, createNewCoupleGroup, joinCoupleGroup } from '../services/authService';
import type { CoupleSession, UserProfile } from '../types/auth';
import type { User } from '@supabase/supabase-js';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sessionData, setSessionData] = useState<CoupleSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isInvalidAuthState = (err: unknown): boolean => {
    const message = err instanceof Error ? err.message : '';
    const lower = message.toLowerCase();
    return (
      lower.includes('invalid login credentials') ||
      lower.includes('jwt expired') ||
      lower.includes('refresh token')
    );
  };

  const extractSessionData = (p: UserProfile | null): CoupleSession | null => {
    if (!p) return null;
    const raw = p.couple_sessions;
    if (!raw) return null;
    if (Array.isArray(raw)) return raw[0] ?? null;
    return raw;
  };

  const mapAuthErrorToSpanish = (err: unknown): string => {
    const message = err instanceof Error ? err.message : '';
    const lower = message.toLowerCase();

    if (lower.includes('invalid login credentials')) return 'Credenciales incorrectas';
    if (lower.includes('email not confirmed')) return 'Confirma tu email antes de iniciar sesión';
    if (lower.includes('user already registered') || lower.includes('already registered')) return 'El email ya está en uso';
    if (lower.includes('password should be at least')) return 'La contraseña es demasiado corta';

    return message || 'Ocurrió un error. Intenta de nuevo.';
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        setIsLoading(true);
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const currentUser = data.session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          const userProfile = await getProfile(currentUser.id);
          setProfile(userProfile);
          setSessionData(extractSessionData(userProfile));
        } else {
          setProfile(null);
          setSessionData(null);
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
        setError(mapAuthErrorToSpanish(err));
        if (isInvalidAuthState(err)) {
          try {
            await supabase.auth.signOut();
          } catch {
            // no-op
          }
          setUser(null);
        }
        setProfile(null);
        setSessionData(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, supabaseSession) => {
      if (event === 'SIGNED_IN' && supabaseSession?.user) {
        setUser(supabaseSession.user);
        setIsLoading(true);
        try {
          const userProfile = await getProfile(supabaseSession.user.id);
          setProfile(userProfile);
          setSessionData(extractSessionData(userProfile));
          setError(null);
        } catch (err) {
          console.error('Error fetching profile:', err);
          setError(mapAuthErrorToSpanish(err));
          if (isInvalidAuthState(err)) {
            try {
              await supabase.auth.signOut();
            } catch {
              // no-op
            }
            setUser(null);
          }
          setProfile(null);
          setSessionData(null);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setSessionData(null);
        setError(null);
        setIsLoading(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const coupleSessionId = profile?.couple_id;
    if (!coupleSessionId) return;

    const channel = supabase
      .channel(`couple_session_auth:${coupleSessionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'couple_sessions',
          filter: `id=eq.${coupleSessionId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const next = payload.new as CoupleSession;
            setSessionData(next);
            setProfile((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                couple_sessions: next,
              };
            });
          }
          if (payload.eventType === 'DELETE') {
            setSessionData(null);
            setProfile((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                couple_sessions: null,
              };
            });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [profile?.couple_id]);

  const handleSignIn = async (email: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);
      const userSession = await signIn(email, password);
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      setUser(data.session?.user ?? null);

      const userProfile = await getProfile(userSession.id);
      setProfile(userProfile);
      setSessionData(extractSessionData(userProfile));
    } catch (err) {
      setError(mapAuthErrorToSpanish(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (email: string, password: string) => {
    try {
      setError(null);
      setIsLoading(true);
      const userSession = await signUp(email, password);
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      setUser(data.session?.user ?? null);

      try {
        const userProfile = await getProfile(userSession.id);
        setProfile(userProfile);
        setSessionData(extractSessionData(userProfile));
      } catch (err) {
        console.error('Error fetching profile after sign up:', err);
      }
    } catch (err) {
      setError(mapAuthErrorToSpanish(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setError(null);
      await signOut();
      setUser(null);
      setProfile(null);
      setSessionData(null);
    } catch (err) {
      setError(mapAuthErrorToSpanish(err));
      throw err;
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const userProfile = await getProfile(user.id);
      setProfile(userProfile);
      setSessionData(extractSessionData(userProfile));
    } catch (err) {
      console.error('Error refreshing profile:', err);
    }
  };

  const createCouple = async () => {
    if (!user) throw new Error('No user');
    try {
      setError(null);
      setIsLoading(true);
      const updated = await createNewCoupleGroup(user.id);
      setProfile(updated);
      setSessionData(extractSessionData(updated));
      return updated;
    } catch (err) {
      setError(mapAuthErrorToSpanish(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const joinCouple = async (coupleCode: string) => {
    if (!user) throw new Error('No user');
    try {
      setError(null);
      setIsLoading(true);
      const updated = await joinCoupleGroup(user.id, coupleCode);
      setProfile(updated);
      setSessionData(extractSessionData(updated));
      return updated;
    } catch (err) {
      setError(mapAuthErrorToSpanish(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const needsCoupleOnboarding = Boolean(user && profile && !profile.couple_id);

  return {
    user,
    profile,
    sessionData,
    isLoading,
    error,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signOut: handleSignOut,
    refreshProfile,
    createCouple,
    joinCouple,
    needsCoupleOnboarding,
  };
};
