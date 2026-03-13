import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, LogOut, User, Users, Share2 } from 'lucide-react';
import { useSync } from '../hooks/useSync';
import { useWorkout } from '../hooks/useWorkout';
import { useWorkoutLogs } from '../hooks/useWorkoutLogs';
import { ExerciseCard } from './features/Workout/ExerciseCard';
import { ThemeToggle } from './ThemeToggle';
import type { CoupleSession, UserProfile } from '../types/auth';
import type { Phase } from '../types/workout';

interface MainWorkoutViewProps {
  profile: UserProfile;
  sessionData: CoupleSession | null;
  onSignOut: () => Promise<void>;
}

export const MainWorkoutView = ({ profile, sessionData, onSignOut }: MainWorkoutViewProps) => {
  const defaultSpreadsheetId = (import.meta.env.VITE_DEFAULT_SPREADSHEET_ID as string | undefined) ?? null;

  const [showSummary, setShowSummary] = useState(false);
  const [weightInputs, setWeightInputs] = useState<Record<string, number>>({});
  const [weightInputsDuo, setWeightInputsDuo] = useState<Record<string, number>>({});

  const [syncStatus, setSyncStatus] = useState<Record<string, 'idle' | 'saving' | 'success' | 'error'>>({});
  const [lastSavedValue, setLastSavedValue] = useState<Record<string, string>>({});
  const syncTimersRef = useRef<Record<string, number | null>>({});

  const [isDuoModeActive, setIsDuoModeActive] = useState<boolean>(() => {
    try {
      const raw = window.localStorage.getItem('isDuoModeActive');
      if (raw === null) return false;
      return raw === 'true';
    } catch {
      return false;
    }
  });

  const [activeRoutine, setActiveRoutine] = useState<number>(() => sessionData?.current_phase || 1);
  const [activeDay, setActiveDay] = useState<string | null>(null);

  useEffect(() => {
    setActiveRoutine(sessionData?.current_phase || 1);
  }, [sessionData?.current_phase]);

  useEffect(() => {
    try {
      window.localStorage.setItem('isDuoModeActive', String(isDuoModeActive));
    } catch {
      // ignore
    }
  }, [isDuoModeActive]);

  const {
    coupleSession,
    loading: syncLoading,
    updateSession,
    createSession,
  } = useSync(profile.couple_id, true);

  useEffect(() => {
    if (!syncLoading && !coupleSession && profile.couple_id) {
      (async () => {
        try {
          await createSession({
            owner_id: profile.id,
            spreadsheet_id: defaultSpreadsheetId,
            current_phase: 1,
            current_day: 1,
            active_exercise_index: 0,
            is_busy_mode: false,
          });
        } catch (err) {
          console.error('[MainWorkoutView] Failed to create couple session:', err);
        }
      })();
    }
  }, [syncLoading, coupleSession, profile.couple_id, createSession]);

  const {
    exercises,
    currentExercise,
    loading: _workoutLoading,
    error: _workoutError,
    status: workoutStatus,
    updatePhase,
    selectedDay,
    setSelectedDay,
    exerciseStatuses,
    toggleExerciseAlternative,
    hasNext,
    hasPrevious,
  } = useWorkout({
    coupleSessionId: coupleSession?.id,
    spreadsheetId: sessionData?.spreadsheet_id ?? defaultSpreadsheetId,
    isProfileLoading: false,
    phase: sessionData?.current_phase || 1,
    activeIndex: coupleSession?.active_exercise_index || 0,
  });

  const isFocusMode = Boolean(selectedDay);

  const handlePhaseChange = async (next: number) => {
    try {
      setActiveRoutine(next);
      updatePhase(next as Phase);
      if (!coupleSession) return;
      await updateSession({
        current_phase: next as Phase,
        current_day: 1,
        active_exercise_index: 0,
      });
      setSelectedDay(null);
      setActiveDay(null);
    } catch (err) {
      console.error('[MainWorkoutView] Failed to change phase:', err);
    }
  };

  const handleNext = async () => {
    if (!coupleSession) return;
    if (!hasNext) return;

    try {
      await updateSession({ active_exercise_index: coupleSession.active_exercise_index + 1 });
    } catch (err) {
      console.error('[MainWorkoutView] Failed to go next:', err);
    }
  };

  const handlePrevious = async () => {
    if (!coupleSession) return;
    if (!hasPrevious) return;

    try {
      await updateSession({ active_exercise_index: Math.max(0, coupleSession.active_exercise_index - 1) });
    } catch (err) {
      console.error('[MainWorkoutView] Failed to go previous:', err);
    }
  };

  const alternativeExerciseId = (() => {
    if (!currentExercise) return null;
    const hasAlternative = Boolean(
      (currentExercise.nombre_alternativa && currentExercise.nombre_alternativa.trim().length > 0) ||
        (currentExercise.video_url_alternativa && currentExercise.video_url_alternativa.trim().length > 0)
    );
    if (!hasAlternative) return null;
    return `${currentExercise.id}::alt`;
  })();

  const isAlternativeActive = Boolean(currentExercise?.id && exerciseStatuses[currentExercise.id]);

  const activeExerciseId = currentExercise
    ? isAlternativeActive && alternativeExerciseId
      ? alternativeExerciseId
      : currentExercise.id
    : null;

  const logs = useWorkoutLogs({
    mainExerciseId: currentExercise?.id ?? null,
    alternativeExerciseId,
    activeExerciseId,
    coupleId: profile.couple_id,
    currentUserId: profile.id,
  });

  const parseSeriesReps = (raw: string | null | undefined): { sets: number; reps: number } => {
    const fallback = { sets: 0, reps: 0 };
    if (!raw) return fallback;

    const normalized = raw
      .toLowerCase()
      .replaceAll('×', 'x')
      .replaceAll('–', '-')
      .replaceAll('—', '-')
      .replaceAll(' ', '');

    const match = normalized.match(/(\d+)x(\d+)(?:-(\d+))?/);
    if (!match) return fallback;

    const sets = Number(match[1]);
    const repsLow = Number(match[2]);
    const repsHigh = match[3] ? Number(match[3]) : null;
    const reps = repsHigh ?? repsLow;

    if (!Number.isFinite(sets) || !Number.isFinite(reps)) return fallback;
    return { sets, reps };
  };

  const calculateSummaryData = () => {
    const routineExercises = exercises ?? [];
    const total = routineExercises.length;

    const performedExercises: Array<{
      id: string;
      name: string;
      sets: number;
      reps: number;
      youWeight: number;
      duoWeight: number;
      youVolume: number;
      duoVolume: number;
    }> = [];

    let userVolume = 0;
    let partnerVolume = 0;
    let completed = 0;
    let topLiftWeight = 0;
    let topLiftExerciseName: string | null = null;

    for (const ex of routineExercises) {
      const youLogged = Number(weightInputs[ex.id]);
      const duoLogged = Number(weightInputsDuo[ex.id]);

      const youWeight = Number.isFinite(youLogged) && youLogged > 0 ? youLogged : 0;
      const duoWeight = Number.isFinite(duoLogged) && duoLogged > 0 ? duoLogged : 0;

      if (youWeight > 0 || (isDuoModeActive && duoWeight > 0)) {
        completed += 1;
      }

      if (youWeight > topLiftWeight) {
        topLiftWeight = youWeight;
        topLiftExerciseName = ex.nombre;
      }

      const { sets, reps } = parseSeriesReps(ex.series_reps);
      const youVolumeRow = sets > 0 && reps > 0 ? youWeight * sets * reps : 0;
      const duoVolumeRow = sets > 0 && reps > 0 ? duoWeight * sets * reps : 0;
      userVolume += youVolumeRow;
      partnerVolume += duoVolumeRow;

      if (youWeight > 0 || (isDuoModeActive && duoWeight > 0)) {
        performedExercises.push({
          id: ex.id,
          name: ex.nombre,
          sets,
          reps,
          youWeight,
          duoWeight,
          youVolume: youVolumeRow,
          duoVolume: duoVolumeRow,
        });
      }
    }

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      userVolumeKg: Math.round(userVolume),
      partnerVolumeKg: Math.round(partnerVolume),
      teamVolumeKg: Math.round(userVolume + partnerVolume),
      completionRate,
      topLift: topLiftExerciseName && topLiftWeight > 0 ? { name: topLiftExerciseName, weight: topLiftWeight } : null,
      performedExercises,
      routineName: `Rutina ${sessionData?.current_phase || 1}`,
    };
  };

  const summary = useMemo(() => {
    if (!showSummary) return null;
    return calculateSummaryData();
  }, [showSummary, exercises, weightInputs, sessionData?.current_phase]);

  const generateShareLink = () => {
    const data = summary ?? calculateSummaryData();

    const isDuo = Boolean(isDuoModeActive);
    if (isDuo) {
      const youName = profile.email ? profile.email.split('@')[0] : 'Tú';
      const message = `💪 ¡Misión en Dúo Completada! 🏋️‍♂️ Total Equipo: *${data.teamVolumeKg.toLocaleString()} kg*. 👤 ${youName}: *${data.userVolumeKg.toLocaleString()} kg* | 👤 Dúo: *${data.partnerVolumeKg.toLocaleString()} kg*. ¡Entrenamiento de nivel Pro! 🔥`;
      return `https://wa.me/?text=${encodeURIComponent(message)}`;
    }

    const top3 = [...data.performedExercises]
      .filter((row) => row.youWeight > 0)
      .sort((a, b) => b.youWeight - a.youWeight)
      .slice(0, 3)
      .map((row) => `${row.name} ${Math.round(row.youWeight)}kg`);

    const top3Text = top3.length > 0 ? top3.join(', ') : '—';
    const message = `💪 ¡Misión Cumplida! Hoy levanté *${data.userVolumeKg.toLocaleString()} kg* en mi rutina de ${data.routineName}. 🏆 Top 3: ${top3Text}. ¡Vamos por más! 🔥`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  };

  const handleCommitWeightYouWithTracking = async () => {
    if (!currentExercise?.id || !activeExerciseId) {
      return false;
    }

    const nextParsed = Number(logs.weightYou);
    const isNoop = Number.isFinite(nextParsed) && logs.confirmedWeightYou !== null && nextParsed === logs.confirmedWeightYou;

    const syncKey = `${activeExerciseId}:you:${profile.id}`;
    if (syncTimersRef.current[syncKey]) {
      window.clearTimeout(syncTimersRef.current[syncKey] as number);
      syncTimersRef.current[syncKey] = null;
    }

    if (isNoop) {
      return true;
    }

    setSyncStatus((prev) => ({ ...prev, [syncKey]: 'saving' }));

    const ok = await logs.commitWeightYou();

    if (!ok) {
      setSyncStatus((prev) => ({ ...prev, [syncKey]: 'error' }));
      return false;
    }

    setSyncStatus((prev) => ({ ...prev, [syncKey]: 'success' }));
    setLastSavedValue((prev) => ({ ...prev, [syncKey]: logs.weightYou }));
    syncTimersRef.current[syncKey] = window.setTimeout(() => {
      setSyncStatus((prev) => ({ ...prev, [syncKey]: 'idle' }));
      syncTimersRef.current[syncKey] = null;
    }, 2000);

    if (currentExercise?.id && Number.isFinite(nextParsed) && nextParsed >= 0) {
      setWeightInputs((prev) => ({ ...prev, [currentExercise.id]: nextParsed }));
    }

    return true;
  };

  const handleCommitWeightDuoWithTracking = async () => {
    if (!currentExercise?.id || !activeExerciseId) {
      return false;
    }

    const nextParsed = Number(logs.weightDuo);
    const isNoop = Number.isFinite(nextParsed) && logs.confirmedWeightDuo !== null && nextParsed === logs.confirmedWeightDuo;

    const syncKey = `${activeExerciseId}:duo:${profile.couple_id ?? 'duo'}`;
    if (syncTimersRef.current[syncKey]) {
      window.clearTimeout(syncTimersRef.current[syncKey] as number);
      syncTimersRef.current[syncKey] = null;
    }

    if (isNoop) {
      return true;
    }

    setSyncStatus((prev) => ({ ...prev, [syncKey]: 'saving' }));

    const ok = await logs.commitWeightDuo();
    if (!ok) {
      setSyncStatus((prev) => ({ ...prev, [syncKey]: 'error' }));
      return false;
    }

    setSyncStatus((prev) => ({ ...prev, [syncKey]: 'success' }));
    setLastSavedValue((prev) => ({ ...prev, [syncKey]: logs.weightDuo }));
    syncTimersRef.current[syncKey] = window.setTimeout(() => {
      setSyncStatus((prev) => ({ ...prev, [syncKey]: 'idle' }));
      syncTimersRef.current[syncKey] = null;
    }, 2000);

    return true;
  };

  const handleWeightYouChangeWithTracking = (value: string) => {
    logs.setWeightYou(value);
    if (!currentExercise?.id) return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    setWeightInputs((prev) => ({ ...prev, [currentExercise.id]: parsed }));
  };

  const handleWeightDuoChangeWithTracking = (value: string) => {
    logs.setWeightDuo(value);
    if (!currentExercise?.id) return;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    setWeightInputsDuo((prev) => ({ ...prev, [currentExercise.id]: parsed }));
  };

  const handleFinalizeWorkout = async () => {
    if (currentExercise?.id) {
      try {
        await handleCommitWeightYouWithTracking();
      } catch {
        // ignore
      }

      if (isDuoModeActive) {
        try {
          await handleCommitWeightDuoWithTracking();
        } catch {
          // ignore
        }
      }
    }

    setShowSummary(true);
  };

const WorkoutSummaryModal = ({ onClose }: { onClose: () => void }) => {
  if (!summary) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 px-5 py-8 flex items-center justify-center backdrop-blur-xl">
      <div className="relative w-full max-w-sm mx-auto rounded-3xl border border-[#2A2A2A] bg-[#121212] p-6 shadow-2xl shadow-emerald-500/10 text-white max-h-[85vh] overflow-y-auto">
        <div className="text-center">
          <h2 className="text-[#FF8C00] font-black text-2xl tracking-tighter text-center uppercase mb-2">MISIÓN CUMPLIDA</h2>
          <p className="text-white text-6xl font-black drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]">
            {(isDuoModeActive ? summary.teamVolumeKg : summary.userVolumeKg).toLocaleString()}
          </p>
          <p className="text-emerald-500 font-bold text-[10px] uppercase tracking-[0.3em] mt-2">KILOGRAMOS DE PODER</p>
          <p className="text-[10px] text-white/50 uppercase tracking-widest mt-4">{summary.routineName}</p>
        </div>

        {summary.performedExercises.length > 0 && isDuoModeActive ? (
          <div className="mt-8 rounded-2xl border border-[#2A2A2A] bg-black/30 p-4">
            <div className="grid grid-cols-2">
              <div className="min-w-0 pr-4">
                <p className="text-[#FF8C00] text-[10px] font-black mb-4 tracking-widest">OPERADOR: ROGER</p>
                <div className="space-y-3">
                  {summary.performedExercises.map((row) => (
                    <div key={`${row.id}:aar:you`} className="flex justify-between gap-3">
                      <p className="text-white/90 text-sm font-medium truncate">{row.name}</p>
                      <p className="text-white/90 text-sm font-medium shrink-0">{Math.round(row.youWeight)} kg</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="min-w-0 pl-4 border-l-2 border-[#2A2A2A]">
                <p className="text-emerald-500 text-[10px] font-black mb-4 tracking-widest">OPERADOR: PATY</p>
                <div className="space-y-3">
                  {summary.performedExercises.map((row) => (
                    <div key={`${row.id}:aar:duo`} className="flex justify-between gap-3">
                      <p className="text-emerald-400 text-sm font-medium truncate">{row.name}</p>
                      <p className="text-emerald-400 text-sm font-medium shrink-0">{Math.round(row.duoWeight)} kg</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : summary.performedExercises.length > 0 ? (
          <div className="mt-8 rounded-2xl border border-[#2A2A2A] bg-black/30 p-4">
            <p className="text-[#FF8C00] text-[10px] font-black mb-4 tracking-widest">OPERADOR</p>
            <div className="space-y-3">
              {summary.performedExercises
                .filter((row) => row.youWeight > 0)
                .map((row) => (
                  <div key={`${row.id}:aar:solo`} className="flex justify-between gap-3">
                    <p className="text-white/90 text-sm font-medium truncate">{row.name}</p>
                    <p className="text-white/90 text-sm font-medium shrink-0">{Math.round(row.youWeight)} kg</p>
                  </div>
                ))}
            </div>
          </div>
        ) : null}

        <div className="mt-8">
          <a
            href={generateShareLink()}
            target="_blank"
            rel="noreferrer"
            className="bg-[#FF8C00] text-black font-black w-full py-5 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-all shadow-lg shadow-orange-900/20"
          >
            <Share2 className="h-5 w-5" />
            COMPARTIR VICTORIA
          </a>

          <button
            type="button"
            onClick={onClose}
            className="block w-full text-center text-[#555555] font-bold text-[10px] uppercase mt-6 hover:text-white transition-colors cursor-pointer"
          >
            CERRAR REPORTE
          </button>
        </div>
      </div>
    </div>
    );
  };

  const handleBackToSelection = () => {
    setSelectedDay(null);
  };

  return (
    <div className="relative min-h-screen bg-[#121212] dark:bg-black text-[#E0E0E0] font-sans transition-all duration-500 ease-in-out">
      {isFocusMode ? (
        <header className="sticky top-0 z-50 bg-[#121212] border-b border-[#2A2A2A]">
          <div className="flex justify-between items-center w-full px-4 py-4 bg-[#121212]">
            <div className="flex items-center gap-3 flex-1 justify-start">
              <button
                type="button"
                onClick={handleBackToSelection}
                className="h-12 w-12 rounded-full border-2 border-emerald-500/40 bg-black/20 text-emerald-400 transition-all duration-500 ease-in-out active:scale-90 flex items-center justify-center"
                aria-label="Volver"
                title="Volver"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>

              <button
                type="button"
                onClick={() => setIsDuoModeActive((v) => !v)}
                className={
                  isDuoModeActive
                    ? 'h-12 w-12 rounded-full border-2 border-emerald-500 bg-emerald-500 text-white transition-all duration-500 ease-in-out active:scale-90 flex items-center justify-center'
                    : 'h-12 w-12 rounded-full border-2 border-emerald-500/40 bg-black/20 text-emerald-400 transition-all duration-500 ease-in-out active:scale-90 flex items-center justify-center'
                }
                aria-label={isDuoModeActive ? 'Cambiar a modo Solo' : 'Cambiar a modo Dúo'}
                title={isDuoModeActive ? 'Dúo' : 'Solo'}
              >
                {isDuoModeActive ? <Users className="w-6 h-6" /> : <User className="w-6 h-6" />}
              </button>
            </div>

            <div className="flex-none px-2">
              <h1 className="text-lg font-black text-[#FF8C00] uppercase tracking-tighter">ENTRENAMIENTO</h1>
            </div>

            <div className="flex items-center gap-3 flex-1 justify-end">
              <ThemeToggle placement="inline" className="h-12 w-12 flex items-center justify-center border-2 border-emerald-500/40" />

              <button
                type="button"
                onClick={onSignOut}
                className="h-12 w-12 rounded-full border-2 border-emerald-500/40 bg-black/20 text-[#FF8C00] transition-all duration-500 ease-in-out active:scale-90 flex items-center justify-center"
                aria-label="Salir"
                title="Salir"
              >
                <LogOut className="w-6 h-6" />
              </button>
            </div>
          </div>
        </header>
      ) : (
        <header className="sticky top-0 z-50 border-b border-[#2A2A2A] bg-[#121212]/80 dark:bg-black/70 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-all duration-500">
          <div className="max-w-md mx-auto px-6">
            <div className="relative flex justify-center items-center h-16 w-full">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-50">
                <button
                  type="button"
                  onClick={() => setIsDuoModeActive((v) => !v)}
                  className={
                    isDuoModeActive
                      ? 'h-12 w-12 rounded-full border-2 border-emerald-500 bg-emerald-500 text-white transition-all duration-500 ease-in-out active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 flex items-center justify-center'
                      : 'h-12 w-12 rounded-full border-2 border-emerald-500 bg-black/20 dark:bg-white/5 text-emerald-400 transition-all duration-500 ease-in-out active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 flex items-center justify-center'
                  }
                  aria-label={isDuoModeActive ? 'Cambiar a modo Solo' : 'Cambiar a modo Dúo'}
                  title={isDuoModeActive ? 'Dúo' : 'Solo'}
                >
                  {isDuoModeActive ? <Users className="h-5 w-5" /> : <User className="h-5 w-5" />}
                </button>

                <ThemeToggle placement="inline" className="h-12 w-12 flex items-center justify-center border-2 border-emerald-500" />
              </div>

              <h1 className="text-xl font-black text-[#FF8C00] uppercase tracking-tighter px-16 text-center w-full">
                ENTRENAMIENTO
              </h1>

              <button
                onClick={onSignOut}
                className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full border-2 border-emerald-500/40 bg-black/20 dark:bg-white/5 text-[#FF8C00] transition-all duration-500 ease-in-out active:scale-90 flex items-center justify-center"
                aria-label="Salir"
                title="Salir"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>
      )}

      <main className="max-w-md mx-auto p-6 space-y-4">
        <div className="bg-[#F9F9F9] dark:bg-[#1E1E1E] border-4 border-emerald-500 rounded-[2.5rem] p-8 shadow-2xl transition-all duration-500 max-w-md mx-auto">
          {!isFocusMode ? (
            <div>
              <span className="text-[#FF8C00] font-black uppercase mb-4 block">Selecciona Rutina</span>

              <div className="grid grid-cols-2 gap-3">
                {[1, 2, 3, 4].map((phase) => {
                  const isActive = activeRoutine === phase;
                  return (
                    <button
                      key={phase}
                      type="button"
                      disabled={workoutStatus === 'loading'}
                      onClick={() => {
                        setActiveRoutine(phase);
                        void handlePhaseChange(phase);
                      }}
                      className={
                        isActive
                          ? 'bg-emerald-500 text-white font-bold rounded-xl py-3 transition-all duration-300 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed'
                          : 'bg-[#FF8C00] text-white font-bold rounded-xl py-3 transition-all duration-300 ease-in-out active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed'
                      }
                    >
                      Rutina {phase}
                    </button>
                  );
                })}
              </div>

              <span className="text-[#FF8C00] font-black uppercase mt-8 mb-4 block">Elige día</span>

              <div className="flex flex-col w-full gap-3">
                {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].map((day) => {
                  const isActive = activeDay === day;
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={workoutStatus === 'loading'}
                      onClick={() => {
                        setActiveDay(day);
                        window.requestAnimationFrame(() => setSelectedDay(day));
                      }}
                      className={
                        isActive
                          ? 'bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-lg transition-all duration-300 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed'
                          : 'bg-white border-2 border-emerald-500 text-[#FF8C00] font-bold py-4 rounded-2xl transition-all duration-300 ease-in-out active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed'
                      }
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {isFocusMode ? (
            <div className="p-6">
              {workoutStatus === 'empty' ? (
                <div className="text-center py-12 transition-all duration-300 opacity-100">
                  <p className="text-[#FF8C00] dark:text-[#FF8C00] text-lg font-semibold">
                    Descanso: No hay rutina para el {selectedDay} en la Fase {sessionData?.current_phase || 1}.
                  </p>
                </div>
              ) : currentExercise ? (
              <div className="transition-all duration-300 opacity-100">
                <ExerciseCard
                  name={currentExercise?.nombre ?? ''}
                  alternativeName={currentExercise?.nombre_alternativa}
                  seriesReps={currentExercise?.series_reps ?? undefined}
                  videoUrl={currentExercise?.video_url ?? undefined}
                  alternativeVideoUrl={currentExercise?.video_url_alternativa ?? undefined}
                  isDuoModeActive={isDuoModeActive}
                  isDuoInputEnabled={true}
                  isAlternativeActive={isAlternativeActive}
                  onToggleAlternative={() => {
                    if (!currentExercise?.id) return;
                    void toggleExerciseAlternative(currentExercise.id);
                  }}
                  previousWeight={logs.previousWeight}
                  weightYou={logs.weightYou}
                  onWeightYouChange={handleWeightYouChangeWithTracking}
                  weightDuo={logs.weightDuo}
                  onWeightDuoChange={handleWeightDuoChangeWithTracking}
                  onCommitWeightYou={handleCommitWeightYouWithTracking}
                  onCommitWeightDuo={handleCommitWeightDuoWithTracking}
                  saving={logs.saving}
                  savingDuo={logs.savingDuo}
                  saveError={logs.saveError}
                  saveErrorDuo={logs.saveErrorDuo}
                  syncStatus={syncStatus}
                  lastSavedValue={lastSavedValue}
                  syncKeyYou={activeExerciseId ? `${activeExerciseId}:you:${profile.id}` : null}
                  syncKeyDuo={activeExerciseId ? `${activeExerciseId}:duo:${profile.couple_id ?? 'duo'}` : null}
                />

                <div className="flex gap-4 mt-6">
                  <button
                    onClick={handlePrevious}
                    disabled={!hasPrevious}
                    className="flex-1 h-11 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-white/10 text-white hover:bg-white/15 border border-white/10"
                  >
                    <ChevronLeft className="w-5 h-5" />
                    Anterior
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!hasNext}
                    className="flex-1 h-11 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-green-500 text-white hover:bg-green-600"
                  >
                    Siguiente
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleFinalizeWorkout}
                  className="w-full bg-emerald-500 text-black font-extrabold py-5 rounded-2xl shadow-[0_10px_20px_rgba(16,185,129,0.2)] active:scale-95 transition-all mt-8 mb-12 uppercase tracking-widest"
                >
                  Finalizar Entrenamiento
                </button>
              </div>
            ) : null}
            </div>
          ) : null}
        </div>
      </main>

      {showSummary ? <WorkoutSummaryModal onClose={() => setShowSummary(false)} /> : null}
    </div>
  );
};
