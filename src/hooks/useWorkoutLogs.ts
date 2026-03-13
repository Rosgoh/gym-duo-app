import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { getLastWeightsForExercise, saveWeight } from '../services/workoutService';

export const useWorkoutLogs = ({
  mainExerciseId,
  alternativeExerciseId,
  activeExerciseId,
  coupleId,
  currentUserId,
}: {
  mainExerciseId: string | null | undefined;
  alternativeExerciseId: string | null | undefined;
  activeExerciseId: string | null | undefined;
  coupleId: string | null | undefined;
  currentUserId: string | null | undefined;
}) => {
  const duoLocalKey = useMemo(() => {
    if (!coupleId) return null;
    return `workout:duo:${coupleId}`;
  }, [coupleId]);
  const exerciseIds = useMemo(() => {
    const ids = [mainExerciseId, alternativeExerciseId].filter(Boolean) as string[];
    return Array.from(new Set(ids));
  }, [mainExerciseId, alternativeExerciseId]);

  const [previousByExerciseId, setPreviousByExerciseId] = useState<Record<string, { you: number | null; duo: number | null }>>({});
  const [weightYouByExerciseId, setWeightYouByExerciseId] = useState<Record<string, string>>({});
  const [weightDuoByExerciseId, setWeightDuoByExerciseId] = useState<Record<string, string>>({});
  const [savingByExerciseId, setSavingByExerciseId] = useState<Record<string, boolean>>({});
  const [savingDuoByExerciseId, setSavingDuoByExerciseId] = useState<Record<string, boolean>>({});
  const [saveErrorByExerciseId, setSaveErrorByExerciseId] = useState<Record<string, boolean>>({});
  const [saveErrorDuoByExerciseId, setSaveErrorDuoByExerciseId] = useState<Record<string, boolean>>({});

  const lastConfirmedByExerciseIdRef = useRef<Record<string, number | null>>({});
  const lastConfirmedDuoByExerciseIdRef = useRef<Record<string, number | null>>({});
  const inFlightByExerciseIdRef = useRef<Record<string, Promise<unknown> | null>>({});
  const inFlightDuoByExerciseIdRef = useRef<Record<string, Promise<unknown> | null>>({});

  const canRun = Boolean(coupleId && currentUserId && exerciseIds.length > 0);

  const activeId = activeExerciseId ?? mainExerciseId ?? null;

  const previousWeight = useMemo(() => {
    if (!activeId) return { you: null, duo: null };
    return previousByExerciseId[activeId] ?? { you: null, duo: null };
  }, [activeId, previousByExerciseId]);

  const weightYou = useMemo(() => {
    if (!activeId) return '';
    return weightYouByExerciseId[activeId] ?? '';
  }, [activeId, weightYouByExerciseId]);

  const confirmedWeightYou = useMemo(() => {
    if (!activeId) return null;
    return lastConfirmedByExerciseIdRef.current[activeId] ?? null;
  }, [activeId]);

  const saving = useMemo(() => {
    if (!activeId) return false;
    return Boolean(savingByExerciseId[activeId]);
  }, [activeId, savingByExerciseId]);

  const savingDuo = useMemo(() => {
    if (!activeId) return false;
    return Boolean(savingDuoByExerciseId[activeId]);
  }, [activeId, savingDuoByExerciseId]);

  const saveError = useMemo(() => {
    if (!activeId) return false;
    return Boolean(saveErrorByExerciseId[activeId]);
  }, [activeId, saveErrorByExerciseId]);

  const saveErrorDuo = useMemo(() => {
    if (!activeId) return false;
    return Boolean(saveErrorDuoByExerciseId[activeId]);
  }, [activeId, saveErrorDuoByExerciseId]);

  const weightDuo = useMemo(() => {
    if (!activeId) return '';
    return weightDuoByExerciseId[activeId] ?? '';
  }, [activeId, weightDuoByExerciseId]);

  const confirmedWeightDuo = useMemo(() => {
    if (!activeId) return null;
    return lastConfirmedDuoByExerciseIdRef.current[activeId] ?? null;
  }, [activeId]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!canRun) {
        setPreviousByExerciseId({});
        setWeightYouByExerciseId({});
        setWeightDuoByExerciseId({});
        lastConfirmedByExerciseIdRef.current = {};
        lastConfirmedDuoByExerciseIdRef.current = {};
        return;
      }

      try {
        if (!isMounted) return;

        const duoLocalMap: Record<string, number | null> = (() => {
          if (!duoLocalKey) return {};
          try {
            const raw = window.localStorage.getItem(duoLocalKey);
            if (!raw) return {};
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            const out: Record<string, number | null> = {};
            for (const [k, v] of Object.entries(parsed)) {
              out[k] = typeof v === 'number' && Number.isFinite(v) ? v : null;
            }
            return out;
          } catch {
            return {};
          }
        })();

        const results = await Promise.all(
          exerciseIds.map(async (id) => {
            const data = await getLastWeightsForExercise({
              exerciseId: id,
              coupleId: coupleId as string,
              currentUserId: currentUserId as string,
            });
            return [id, { ...data, duo: duoLocalMap[id] ?? null }] as const;
          })
        );

        if (!isMounted) return;

        const nextPrevious: Record<string, { you: number | null; duo: number | null }> = {};
        const nextWeightYou: Record<string, string> = {};
        const nextWeightDuo: Record<string, string> = {};
        const nextConfirmed: Record<string, number | null> = { ...lastConfirmedByExerciseIdRef.current };
        const nextConfirmedDuo: Record<string, number | null> = { ...lastConfirmedDuoByExerciseIdRef.current };
        const nextSaveError: Record<string, boolean> = { ...saveErrorByExerciseId };
        const nextSaveErrorDuo: Record<string, boolean> = { ...saveErrorDuoByExerciseId };

        for (const [id, data] of results) {
          nextPrevious[id] = data;
          nextConfirmed[id] = data.you;
          nextWeightYou[id] = data.you === null ? '' : String(data.you);
          nextConfirmedDuo[id] = data.duo;
          nextWeightDuo[id] = data.duo === null ? '' : String(data.duo);
          nextSaveError[id] = false;
          nextSaveErrorDuo[id] = false;
        }

        lastConfirmedByExerciseIdRef.current = nextConfirmed;
        lastConfirmedDuoByExerciseIdRef.current = nextConfirmedDuo;
        setPreviousByExerciseId(nextPrevious);
        setWeightYouByExerciseId(nextWeightYou);
        setWeightDuoByExerciseId(nextWeightDuo);
        setSaveErrorByExerciseId(nextSaveError);
        setSaveErrorDuoByExerciseId(nextSaveErrorDuo);
      } catch (err) {
        console.error('[useWorkoutLogs] Failed to load weights:', err);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [canRun, exerciseIds, coupleId, currentUserId, duoLocalKey]);

  useEffect(() => {
    if (!canRun) return;

    const channel = supabase
      .channel(`workout_logs:${coupleId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'workout_logs',
          filter: `couple_id=eq.${coupleId}`,
        },
        (payload) => {
          const row = payload.new as {
            exercise_id?: string;
            user_id?: string;
            weight?: number;
          };

          const rowExerciseId = row.exercise_id ?? null;
          if (!rowExerciseId) return;
          if (!exerciseIds.includes(rowExerciseId)) return;
          if (typeof row.weight !== 'number') return;

          const nextWeight: number = row.weight;

          setPreviousByExerciseId((prev) => {
            if (!rowExerciseId) return prev;
            const current = prev[rowExerciseId] ?? { you: null, duo: null };
            if (row.user_id !== currentUserId) return prev;
            return { ...prev, [rowExerciseId]: { ...current, you: nextWeight } };
          });

          if (row.user_id === currentUserId && rowExerciseId) {
            lastConfirmedByExerciseIdRef.current = {
              ...lastConfirmedByExerciseIdRef.current,
              [rowExerciseId]: nextWeight,
            };
          }

          // "Dúo" es local: no se sincroniza por realtime.
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [canRun, coupleId, currentUserId, exerciseIds]);

  const setWeightYou = useCallback(
    (value: string) => {
      if (!activeId) return;
      setWeightYouByExerciseId((prev) => ({ ...prev, [activeId]: value }));
    },
    [activeId]
  );

  const setWeightDuo = useCallback(
    (value: string) => {
      if (!activeId) return;
      setWeightDuoByExerciseId((prev) => ({ ...prev, [activeId]: value }));
    },
    [activeId]
  );

  const commitWeightYou = useCallback(async (): Promise<boolean> => {
    if (!canRun || !activeId) return false;

    const raw = weightYouByExerciseId[activeId] ?? '';
    const trimmed = raw.trim();
    if (!trimmed) return false;

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return false;

    const last = lastConfirmedByExerciseIdRef.current[activeId] ?? null;
    if (last !== null && parsed === last) return true;

    const existingInFlight = inFlightByExerciseIdRef.current[activeId] ?? null;
    if (existingInFlight) return false;

    setSavingByExerciseId((prev) => ({ ...prev, [activeId]: true }));
    setSaveErrorByExerciseId((prev) => ({ ...prev, [activeId]: false }));

    setPreviousByExerciseId((prev) => {
      const current = prev[activeId] ?? { you: null, duo: null };
      return { ...prev, [activeId]: { ...current, you: parsed } };
    });

    const p = saveWeight({
      exerciseId: activeId,
      coupleId: coupleId as string,
      userId: currentUserId as string,
      weight: parsed,
    })
      .then(() => {
        lastConfirmedByExerciseIdRef.current = {
          ...lastConfirmedByExerciseIdRef.current,
          [activeId]: parsed,
        };
        return true;
      })
      .catch((err) => {
        console.error('[useWorkoutLogs] Failed to save weight:', err);
        setSaveErrorByExerciseId((prev) => ({ ...prev, [activeId]: true }));
        return false;
      })
      .finally(() => {
        inFlightByExerciseIdRef.current = { ...inFlightByExerciseIdRef.current, [activeId]: null };
        setSavingByExerciseId((prev) => ({ ...prev, [activeId]: false }));
      });

    inFlightByExerciseIdRef.current = { ...inFlightByExerciseIdRef.current, [activeId]: p };
    return await p;
  }, [canRun, activeId, coupleId, currentUserId, weightYouByExerciseId]);

  const commitWeightDuo = useCallback(async (): Promise<boolean> => {
    if (!canRun || !activeId) return false;
    if (!duoLocalKey) return false;

    const raw = weightDuoByExerciseId[activeId] ?? '';
    const trimmed = raw.trim();
    if (!trimmed) return false;

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return false;

    const last = lastConfirmedDuoByExerciseIdRef.current[activeId] ?? null;
    if (last !== null && parsed === last) return true;

    const existingInFlight = inFlightDuoByExerciseIdRef.current[activeId] ?? null;
    if (existingInFlight) return false;

    setSavingDuoByExerciseId((prev) => ({ ...prev, [activeId]: true }));
    setSaveErrorDuoByExerciseId((prev) => ({ ...prev, [activeId]: false }));

    setPreviousByExerciseId((prev) => {
      const current = prev[activeId] ?? { you: null, duo: null };
      return { ...prev, [activeId]: { ...current, duo: parsed } };
    });

    const p = (async () => {
      try {
        const existingRaw = window.localStorage.getItem(duoLocalKey);
        const existing = existingRaw ? (JSON.parse(existingRaw) as Record<string, unknown>) : {};
        const next = { ...existing, [activeId]: parsed };
        window.localStorage.setItem(duoLocalKey, JSON.stringify(next));

        lastConfirmedDuoByExerciseIdRef.current = {
          ...lastConfirmedDuoByExerciseIdRef.current,
          [activeId]: parsed,
        };
        return true;
      } catch (err) {
        console.error('[useWorkoutLogs] Failed to save duo weight locally:', err);
        setSaveErrorDuoByExerciseId((prev) => ({ ...prev, [activeId]: true }));
        return false;
      } finally {
        inFlightDuoByExerciseIdRef.current = { ...inFlightDuoByExerciseIdRef.current, [activeId]: null };
        setSavingDuoByExerciseId((prev) => ({ ...prev, [activeId]: false }));
      }
    })();

    inFlightDuoByExerciseIdRef.current = { ...inFlightDuoByExerciseIdRef.current, [activeId]: p };
    return await p;
  }, [canRun, activeId, duoLocalKey, weightDuoByExerciseId]);

  return {
    previousWeight,
    weightYou,
    confirmedWeightYou,
    setWeightYou,
    weightDuo,
    confirmedWeightDuo,
    setWeightDuo,
    saving,
    savingDuo,
    saveError,
    saveErrorDuo,
    commitWeightYou,
    commitWeightDuo,
  };
};
