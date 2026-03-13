import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import type { CoupleSession } from '../types/workout';

export const useSync = (coupleId: string | null | undefined, isActive: boolean = true) => {
  const [coupleSession, setCoupleSession] = useState<CoupleSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [presenceCount, setPresenceCount] = useState(0);
  const [presenceStatus, setPresenceStatus] = useState<'Solo' | 'Sincronizado'>('Solo');

  const retryTimeoutRef = useRef<number | null>(null);
  const retryAttemptRef = useRef(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isCleaningUpRef = useRef(false);
  const isMountedRef = useRef(false);

  const formatSupabaseError = (err: unknown): string => {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    if (err instanceof Error) return err.message;

    const anyErr = err as {
      message?: string;
      details?: string;
      hint?: string;
      code?: string;
    };

    const parts = [
      anyErr.code ? `[${anyErr.code}]` : null,
      anyErr.message ?? null,
      anyErr.details ?? null,
      anyErr.hint ?? null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' ') : 'Unknown error';
  };

  useEffect(() => {
    isMountedRef.current = true;
    isCleaningUpRef.current = false;

    if (!coupleId || !isActive) {
      setLoading(false);
      setPresenceCount(0);
      setPresenceStatus('Solo');
      return;
    }

    retryAttemptRef.current = 0;
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    const fetchSession = async () => {
      try {
        const { data, error: fetchError } = await supabase.from('couple_sessions').select('*').eq('id', coupleId).maybeSingle();

        if (fetchError) throw fetchError;
        setCoupleSession((data as CoupleSession | null) ?? null);
      } catch (err) {
        console.error('Error fetching couple session:', err);
        setError(formatSupabaseError(err));
      } finally {
        setLoading(false);
      }
    };

    fetchSession();

    const presenceKey = (() => {
      return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    })();

    const createAndSubscribeChannel = () => {
      const channel = supabase
        .channel(`session:${coupleId}`, {
          config: {
            presence: { key: presenceKey },
          },
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'couple_sessions',
            filter: `id=eq.${coupleId}`,
          },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              setCoupleSession(payload.new as CoupleSession);
            } else if (payload.eventType === 'DELETE') {
              setCoupleSession(null);
            }
          }
        )
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState();
          const count = Object.keys(state).length;
          setPresenceCount(count);
          setPresenceStatus(count >= 2 ? 'Sincronizado' : 'Solo');
        })
        .on('presence', { event: 'join' }, () => {
          const state = channel.presenceState();
          const count = Object.keys(state).length;
          setPresenceCount(count);
          setPresenceStatus(count >= 2 ? 'Sincronizado' : 'Solo');
        })
        .on('presence', { event: 'leave' }, () => {
          const state = channel.presenceState();
          const count = Object.keys(state).length;
          setPresenceCount(count);
          setPresenceStatus(count >= 2 ? 'Sincronizado' : 'Solo');
        });

      channel.subscribe(async (status) => {
        if (!isMountedRef.current || isCleaningUpRef.current) return;

        if (status === 'SUBSCRIBED') {
          retryAttemptRef.current = 0;
          await channel.track({ online_at: new Date().toISOString() });
          return;
        }

        if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          if (isCleaningUpRef.current) return;
          const attempt = retryAttemptRef.current;
          const backoffMs = Math.min(15000, 500 * Math.pow(2, attempt));
          retryAttemptRef.current += 1;
          console.warn(`[useSync] Realtime channel status=${status}. Reconnecting in ${backoffMs}ms`, {
            coupleId,
            attempt: retryAttemptRef.current,
          });

          if (retryTimeoutRef.current) window.clearTimeout(retryTimeoutRef.current);
          retryTimeoutRef.current = window.setTimeout(() => {
            if (!isMountedRef.current || isCleaningUpRef.current) return;
            channel.unsubscribe();

            const next = createAndSubscribeChannel();
            channelRef.current = next;
          }, backoffMs);
        }
      });

      return channel;
    };

    const channel = createAndSubscribeChannel();
    channelRef.current = channel;

    return () => {
      isCleaningUpRef.current = true;
      isMountedRef.current = false;
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [coupleId, isActive]);

  const updateSession = useCallback(
    async (updates: Partial<CoupleSession>) => {
      if (!coupleId) {
        throw new Error('No couple ID available');
      }

      try {
        const { data, error: updateError } = await supabase
          .from('couple_sessions')
          .update(updates)
          .eq('id', coupleId)
          .select()
          .maybeSingle();

        if (updateError) throw updateError;
        if (data) setCoupleSession(data as CoupleSession);
        return data as CoupleSession;
      } catch (err) {
        console.error('Error updating couple session:', err);
        setError(formatSupabaseError(err));
        throw err;
      }
    },
    [coupleId]
  );

  const createSession = useCallback(
    async (initialData: Omit<CoupleSession, 'id' | 'updated_at'>) => {
      try {
        if (!coupleId) {
          throw new Error('No couple ID available');
        }

        const payload = {
          id: coupleId,
          ...initialData,
        };

        const { data, error: createError } = await supabase
          .from('couple_sessions')
          .upsert(payload, { onConflict: 'id' })
          .select()
          .maybeSingle();

        if (createError) throw createError;
        if (data) setCoupleSession(data as CoupleSession);
        return data as CoupleSession;
      } catch (err) {
        const formatted = formatSupabaseError(err);
        const anyErr = err as {
          message?: string;
          details?: string;
          hint?: string;
          code?: string;
        };

        console.error(
          'Error creating couple session:',
          formatted,
          {
            code: anyErr?.code,
            message: anyErr?.message,
            details: anyErr?.details,
            hint: anyErr?.hint,
          },
          err
        );
        setError(formatSupabaseError(err));
        throw err;
      }
    },
    [coupleId]
  );

  return {
    coupleSession,
    loading,
    error,
    presenceCount,
    presenceStatus,
    updateSession,
    createSession,
  };
};
