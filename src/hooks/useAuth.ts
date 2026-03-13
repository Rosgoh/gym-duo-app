import { useState, useEffect, useRef } from 'react';
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
  
  const profileRef = useRef<UserProfile | null>(null);
  const userRef = useRef<User | null>(null);

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> => {
    let timeoutHandle: number | null = null;
    try {
      const timeoutPromise = new Promise<T>((_, reject) => {
        timeoutHandle = window.setTimeout(() => {
          reject(new Error(`${label} timeout`));
        }, timeoutMs);
      });
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutHandle !== null) window.clearTimeout(timeoutHandle);
    }
  };

  const INIT_TIMEOUT = 15000;
  const PROFILE_TIMEOUT = 15000;

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
        console.log('[useAuth] initAuth START, isHidden:', document.hidden);
        setIsLoading(true);
        console.log('[useAuth] calling getSession...');
        const { data, error: sessionError } = await withTimeout(supabase.auth.getSession(), INIT_TIMEOUT, 'supabase.getSession');
        console.log('[useAuth] getSession resolved, error:', sessionError);
        if (sessionError) throw sessionError;

        const currentUser = data.session?.user ?? null;
        console.log('[useAuth] currentUser:', currentUser?.id ?? 'null');
        setUser(currentUser);

        if (currentUser) {
          if (document.hidden) {
            console.log('[useAuth] tab hidden, skipping profile fetch');
            setProfile(null);
            setSessionData(null);
            return;
          }

          console.log('[useAuth] calling getProfile...');
          const userProfile = await withTimeout(getProfile(currentUser.id), PROFILE_TIMEOUT, 'getProfile');
          console.log('[useAuth] getProfile resolved');
          profileRef.current = userProfile;
          setProfile(userProfile);
          setSessionData(extractSessionData(userProfile));
        } else {
          setProfile(null);
          setSessionData(null);
        }
      } catch (err) {
        console.error('[useAuth] initAuth ERROR:', err);
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
        console.log('[useAuth] initAuth FINALLY, setting isLoading=false');
        setIsLoading(false);
      }
    };

    console.log('[useAuth] useEffect mount, calling initAuth');
    initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, supabaseSession) => {
      console.log('[useAuth] onAuthStateChange event:', event, 'isHidden:', document.hidden);
      if (event === 'SIGNED_IN' && supabaseSession?.user) {
        console.log('[useAuth] SIGNED_IN, userId:', supabaseSession.user.id);
        userRef.current = supabaseSession.user;
        setUser(supabaseSession.user);
        
        if (profileRef.current && profileRef.current.id === supabaseSession.user.id) {
          console.log('[useAuth] SIGNED_IN but profile already exists (via ref), skipping reload');
          setError(null);
          return;
        }
        
        setIsLoading(true);
        try {
          if (document.hidden) {
            console.log('[useAuth] tab hidden during SIGNED_IN, skipping profile');
            return;
          }
          console.log('[useAuth] calling getProfile after SIGNED_IN...');
          const userProfile = await withTimeout(getProfile(supabaseSession.user.id), PROFILE_TIMEOUT, 'getProfile');
          console.log('[useAuth] getProfile resolved after SIGNED_IN');
          profileRef.current = userProfile;
          setProfile(userProfile);
          setSessionData(extractSessionData(userProfile));
          setError(null);
        } catch (err) {
          console.error('[useAuth] Error fetching profile after SIGNED_IN:', err);
          const errMsg = mapAuthErrorToSpanish(err);
          console.log('[useAuth] Preserving existing profile despite error');
          if (isInvalidAuthState(err)) {
            try {
              await supabase.auth.signOut();
            } catch {
              // no-op
            }
            setUser(null);
            setProfile(null);
            setSessionData(null);
            setError(errMsg);
          }
        } finally {
          console.log('[useAuth] SIGNED_IN FINALLY, setting isLoading=false');
          setIsLoading(false);
        }
        return;
      }

      if (event === 'SIGNED_OUT') {
        console.log('[useAuth] SIGNED_OUT');
        userRef.current = null;
        profileRef.current = null;
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
    const handleVisibility = () => {
      console.log('[useAuth] visibilitychange, hidden:', document.hidden, 'user:', user?.id ?? 'null', 'profile:', !!profile);
      if (document.hidden) return;
      if (!user) return;
      if (profile) return;

      console.log('[useAuth] tab visible, user exists, no profile - fetching...');
      setIsLoading(true);
      withTimeout(getProfile(user.id), PROFILE_TIMEOUT, 'getProfile')
        .then((userProfile) => {
          console.log('[useAuth] getProfile on visibility resolved');
          profileRef.current = userProfile;
          setProfile(userProfile);
          setSessionData(extractSessionData(userProfile));
          setError(null);
        })
        .catch((err) => {
          console.error('[useAuth] Error fetching profile on visibility:', err);
          setError(mapAuthErrorToSpanish(err));
        })
        .finally(() => {
          console.log('[useAuth] visibility fetch FINALLY, setting isLoading=false');
          setIsLoading(false);
        });
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user, profile]);

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
