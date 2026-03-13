import { useState, useEffect, useCallback, useRef } from 'react';
import { getExercisesByContext } from '../services/sheetsService';
import { supabase } from '../services/supabaseClient';
import { getExerciseStatuses, setExerciseAlternativeActive } from '../services/workoutService';
import type { Exercise } from '../types/workout';

interface UseWorkoutProps {
  coupleSessionId: string | null | undefined;
  spreadsheetId: string | null | undefined;
  isProfileLoading: boolean;
  phase: number;
  activeIndex: number;
}

export const useWorkout = ({ coupleSessionId, spreadsheetId, isProfileLoading, phase, activeIndex }: UseWorkoutProps) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [status, setStatus] = useState<'checking_profile' | 'idle' | 'loading' | 'ready' | 'empty' | 'no-config' | 'error'>('checking_profile');
  const [error, setError] = useState<string | null>(null);
  const [isAlternativeActive, setIsAlternativeActive] = useState(false);

  const [exerciseStatuses, setExerciseStatuses] = useState<Record<string, boolean>>({});

  const statusRetryTimeoutRef = useRef<number | null>(null);
  const statusRetryAttemptRef = useRef(0);
  const statusChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isStatusCleaningUpRef = useRef(false);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const targetDay = selectedDay;
  const targetPhase = phase;

  const updatePhase = useCallback(
    async (newPhase: number) => {
      if (!coupleSessionId) {
        throw new Error('No hay sesión activa para actualizar la fase');
      }

      const safePhase = Number(newPhase);
      if (!Number.isFinite(safePhase) || safePhase < 1 || safePhase > 4) {
        throw new Error('Fase inválida');
      }

      const { error: updateError } = await supabase
        .from('couple_sessions')
        .update({
          current_phase: safePhase,
          active_exercise_index: 0,
        })
        .eq('id', coupleSessionId);

      if (updateError) throw updateError;
    },
    [coupleSessionId]
  );

  useEffect(() => {
    const loadExercises = async () => {
      try {
        if (isProfileLoading) {
          setStatus('checking_profile');
          return;
        }

        if (!targetDay) {
          setExercises([]);
          setError(null);
          setStatus('idle');
          return;
        }

        if (!spreadsheetId) {
          setExercises([]);
          setError(null);
          setStatus('no-config');
          return;
        }

        setStatus('loading');
        setError(null);

        console.log(`[Workout] Loading Phase ${targetPhase} for ${targetDay}`);
        const data = await getExercisesByContext(spreadsheetId, targetDay, targetPhase);
        setExercises(data);
        setStatus(data.length === 0 ? 'empty' : 'ready');
      } catch (err) {
        console.error('Error loading exercises:', err);
        setError(err instanceof Error ? err.message : 'Failed to load exercises');
        setStatus('error');
      } finally {
        // no-op (status already set)
      }
    };

    loadExercises();
  }, [spreadsheetId, isProfileLoading, targetDay, targetPhase]);

  useEffect(() => {
    let isMounted = true;

    const hydrateStatuses = async () => {
      if (!coupleSessionId) return;
      if (exercises.length === 0) {
        setExerciseStatuses({});
        return;
      }

      try {
        const map = await getExerciseStatuses({
          coupleId: coupleSessionId,
          exerciseIds: exercises.map((e) => e.id),
        });

        if (!isMounted) return;
        setExerciseStatuses(map);
      } catch (err) {
        console.error('[useWorkout] Failed to hydrate exercise statuses:', err);
      }
    };

    hydrateStatuses();

    return () => {
      isMounted = false;
    };
  }, [coupleSessionId, exercises]);

  useEffect(() => {
    if (!coupleSessionId) return;

    isStatusCleaningUpRef.current = false;
    statusRetryAttemptRef.current = 0;
    if (statusRetryTimeoutRef.current) {
      window.clearTimeout(statusRetryTimeoutRef.current);
      statusRetryTimeoutRef.current = null;
    }

    const createAndSubscribe = () => {
      const channel = supabase
        .channel(`exercise_status:${coupleSessionId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'exercise_status',
            filter: `couple_id=eq.${coupleSessionId}`,
          },
          (payload) => {
            if (payload.eventType === 'DELETE') {
              const oldRow = payload.old as { exercise_id?: string };
              const exId = oldRow.exercise_id;
              if (!exId) return;
              setExerciseStatuses((prev) => {
                const next = { ...prev };
                delete next[exId];
                return next;
              });
              return;
            }

            const row = payload.new as {
              exercise_id?: string;
              is_alternative_active?: boolean | null;
            };

            const exId = row.exercise_id;
            if (!exId) return;

            setExerciseStatuses((prev) => ({
              ...prev,
              [exId]: Boolean(row.is_alternative_active),
            }));
          }
        );

      channel.subscribe((status) => {
        if (isStatusCleaningUpRef.current) return;

        if (status === 'SUBSCRIBED') {
          statusRetryAttemptRef.current = 0;
          return;
        }

        if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          const attempt = statusRetryAttemptRef.current;
          const backoffMs = Math.min(15000, 500 * Math.pow(2, attempt));
          statusRetryAttemptRef.current += 1;

          if (statusRetryTimeoutRef.current) window.clearTimeout(statusRetryTimeoutRef.current);
          statusRetryTimeoutRef.current = window.setTimeout(() => {
            if (isStatusCleaningUpRef.current) return;
            channel.unsubscribe();
            const next = createAndSubscribe();
            statusChannelRef.current = next;
          }, backoffMs);
        }
      });

      return channel;
    };

    const channel = createAndSubscribe();
    statusChannelRef.current = channel;

    return () => {
      isStatusCleaningUpRef.current = true;
      if (statusRetryTimeoutRef.current) {
        window.clearTimeout(statusRetryTimeoutRef.current);
        statusRetryTimeoutRef.current = null;
      }
      statusChannelRef.current?.unsubscribe();
      statusChannelRef.current = null;
    };
  }, [coupleSessionId]);

  const toggleExerciseAlternative = useCallback(
    async (exerciseId: string, enabled?: boolean) => {
      if (!coupleSessionId) return;
      if (!exerciseId) return;

      const nextValue = typeof enabled === 'boolean' ? enabled : !Boolean(exerciseStatuses[exerciseId]);
      const prevValue = Boolean(exerciseStatuses[exerciseId]);

      setExerciseStatuses((prev) => ({ ...prev, [exerciseId]: nextValue }));

      try {
        await setExerciseAlternativeActive({
          coupleId: coupleSessionId,
          exerciseId,
          isAlternativeActive: nextValue,
        });
      } catch (err) {
        console.error('[useWorkout] Failed to toggle alternative mode:', err);
        setExerciseStatuses((prev) => ({ ...prev, [exerciseId]: prevValue }));
      }
    },
    [coupleSessionId, exerciseStatuses]
  );

  useEffect(() => {
    setIsAlternativeActive(false);
  }, [targetPhase, activeIndex]);

  const currentExercise = exercises[activeIndex] || null;

  const hasNext = activeIndex < exercises.length - 1;
  const hasPrevious = activeIndex > 0;

  return {
    exercises,
    currentExercise,
    loading: status === 'loading' || status === 'checking_profile',
    status,
    error,
    targetDay,
    targetPhase,
    selectedDay,
    setSelectedDay,
    isAlternativeActive,
    setIsAlternativeActive,
    exerciseStatuses,
    toggleExerciseAlternative,
    updatePhase,
    hasNext,
    hasPrevious,
    totalExercises: exercises.length,
  };
};
