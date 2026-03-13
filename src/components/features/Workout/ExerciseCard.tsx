import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Clock, Play, X } from 'lucide-react';
import type { ReactNode } from 'react';

const getYouTubeID = (url: string): string | null => {
  const raw = url.trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);

    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.replace('/', '').trim();
      return id || null;
    }

    if (parsed.hostname.includes('youtube.com')) {
      const id = parsed.searchParams.get('v');
      return id || null;
    }

    return null;
  } catch {
    return null;
  }
};

interface VideoModalProps {
  isOpen: boolean;
  title: string;
  videoUrl: string;
  onClose: () => void;
}

const VideoModal = ({ isOpen, title, videoUrl, onClose }: VideoModalProps): ReactNode => {
  const youtubeId = useMemo(() => getYouTubeID(videoUrl), [videoUrl]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pushedHistoryRef = useRef(false);

  const requestFullscreenSafe = async (el: HTMLElement) => {
    try {
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        await el.requestFullscreen();
      }
    } catch {
      // Ignore: fullscreen may be blocked (iOS Safari / permissions)
    }
  };

  const exitFullscreenSafe = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handlePopState = () => {
      if (pushedHistoryRef.current) pushedHistoryRef.current = false;
      onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.history.pushState({ videoModal: true }, '');
    pushedHistoryRef.current = true;
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('popstate', handlePopState);

    if (containerRef.current) {
      void requestFullscreenSafe(containerRef.current);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('popstate', handlePopState);
      document.body.style.overflow = previousOverflow;
      void exitFullscreenSafe();
    };
  }, [isOpen, onClose]);

  const handleRequestClose = () => {
    if (pushedHistoryRef.current) {
      pushedHistoryRef.current = false;
      window.history.back();
      return;
    }

    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 h-full w-full">
      <button
        type="button"
        className="absolute inset-0 z-40 bg-black/95"
        aria-label="Cerrar"
        onClick={handleRequestClose}
      />

      <div className="pointer-events-none absolute inset-0 z-[60] flex items-start justify-between p-6">
        <div className="pointer-events-auto min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Reproduciendo ejercicio</p>
          <h3 className="mt-1 max-w-[70vw] truncate text-sm font-semibold text-white">{title}</h3>
        </div>

        <button
          type="button"
          onClick={handleRequestClose}
          className="pointer-events-auto h-12 w-12 rounded-full border border-white/10 bg-black/40 backdrop-blur-md text-white/90 transition-transform active:scale-90 hover:bg-white/10 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          aria-label="Cerrar"
          title="Cerrar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="pointer-events-none relative z-50 flex h-full w-full items-center justify-center px-4 py-6">
        <div ref={containerRef} className="pointer-events-auto w-full max-w-6xl">
          <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-2xl">
            {youtubeId ? (
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
                className="h-full w-full"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                title={title}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-6 text-center">
                <p className="text-sm text-zinc-300">No se pudo cargar el video.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

interface ExerciseCardProps {
  name: string;
  alternativeName?: string | null;
  seriesReps?: string;
  videoUrl?: string | null;
  alternativeVideoUrl?: string | null;
  isDuoModeActive: boolean;
  isDuoInputEnabled?: boolean;
  isAlternativeActive: boolean;
  onToggleAlternative: () => void;
  previousWeight: {
    you: number | null;
    duo: number | null;
  };
  weightYou: string;
  onWeightYouChange: (value: string) => void;
  weightDuo: string;
  onWeightDuoChange?: (value: string) => void;
  onCommitWeightYou: () => boolean | Promise<boolean>;
  onCommitWeightDuo?: () => boolean | Promise<boolean>;
  saving?: boolean;
  savingDuo?: boolean;
  saveError?: boolean;
  saveErrorDuo?: boolean;
  syncStatus?: Record<string, 'idle' | 'saving' | 'success' | 'error'>;
  lastSavedValue?: Record<string, string>;
  syncKeyYou?: string | null;
  syncKeyDuo?: string | null;
}

export const ExerciseCard = ({
  name,
  alternativeName,
  seriesReps,
  videoUrl,
  alternativeVideoUrl,
  isDuoModeActive,
  isDuoInputEnabled,
  isAlternativeActive,
  onToggleAlternative,
  previousWeight,
  weightYou,
  onWeightYouChange,
  weightDuo,
  onWeightDuoChange,
  onCommitWeightYou,
  onCommitWeightDuo,
  saving,
  savingDuo,
  saveError,
  saveErrorDuo,
  syncStatus,
  lastSavedValue,
  syncKeyYou,
  syncKeyDuo,
}: ExerciseCardProps): ReactNode => {
  const [showVideo, setShowVideo] = useState(false);
  const [savedFlash, setSavedFlash] = useState<'you' | 'duo' | null>(null);

  const stats = useMemo(() => {
    if (!seriesReps) return null;
    const normalized = seriesReps
      .toLowerCase()
      .replaceAll('×', 'x')
      .replaceAll('–', '-')
      .replaceAll('—', '-')
      .replaceAll(' ', '');
    const match = normalized.match(/(\d+)x(\d+(?:-\d+)?)/);
    if (!match) return null;
    const sets = Number(match[1]);
    const reps = match[2];
    if (!Number.isFinite(sets) || !reps) return null;
    return { sets, reps };
  }, [seriesReps]);

  const weightInputBaseClass =
    'h-11 w-full bg-transparent px-1 text-2xl font-bold text-[#121212] dark:text-white text-center placeholder:text-[#888888] focus:outline-none appearance-none';

  const inputYouRef = useRef<HTMLInputElement | null>(null);
  const inputDuoRef = useRef<HTMLInputElement | null>(null);

  const youStatus = (syncKeyYou && syncStatus ? syncStatus[syncKeyYou] : undefined) ?? 'idle';
  const duoStatus = (syncKeyDuo && syncStatus ? syncStatus[syncKeyDuo] : undefined) ?? 'idle';
  const youHasCheck = Boolean(syncKeyYou && lastSavedValue && lastSavedValue[syncKeyYou] === weightYou && weightYou.trim());
  const duoHasCheck = Boolean(syncKeyDuo && lastSavedValue && lastSavedValue[syncKeyDuo] === weightDuo && weightDuo.trim());

  const youBaselineValue = (syncKeyYou && lastSavedValue ? lastSavedValue[syncKeyYou] : undefined) ??
    (previousWeight.you === null ? '' : String(previousWeight.you));
  const duoBaselineValue = (syncKeyDuo && lastSavedValue ? lastSavedValue[syncKeyDuo] : undefined) ??
    (previousWeight.duo === null ? '' : String(previousWeight.duo));

  const youTrimmed = weightYou.trim();
  const duoTrimmed = weightDuo.trim();
  const youIsDirty = Boolean(youTrimmed && youTrimmed !== youBaselineValue);
  const duoIsDirty = Boolean(duoTrimmed && duoTrimmed !== duoBaselineValue);

  const hasAlternative = Boolean(
    (alternativeName && alternativeName.trim().length > 0) ||
      (alternativeVideoUrl && alternativeVideoUrl.trim().length > 0)
  );

  const effectiveName = isAlternativeActive ? alternativeName || name : name;
  const effectiveVideoUrl = isAlternativeActive ? alternativeVideoUrl || videoUrl : videoUrl;
  const hasVideo = Boolean(effectiveVideoUrl && effectiveVideoUrl.trim().length > 0);

  const handleToggleAlternative = () => {
    if (!hasAlternative) return;
    onToggleAlternative();
    setShowVideo(false);
  };

  const showDuoColumn = Boolean(isDuoModeActive);
  const duoEnabled = Boolean(showDuoColumn && isDuoInputEnabled && onWeightDuoChange && onCommitWeightDuo);

  const handleCommitYou = async () => {
    const ok = await onCommitWeightYou();
    if (!ok) return;
    setSavedFlash('you');
    window.setTimeout(() => setSavedFlash((v) => (v === 'you' ? null : v)), 500);
  };

  const handleCommitDuo = async () => {
    if (!onCommitWeightDuo) return;
    const ok = await onCommitWeightDuo();
    if (!ok) return;
    setSavedFlash('duo');
    window.setTimeout(() => setSavedFlash((v) => (v === 'duo' ? null : v)), 500);
  };

  const handleYouKeyDown: React.KeyboardEventHandler<HTMLInputElement> = async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    e.stopPropagation();
    await handleCommitYou();
    if (duoEnabled) {
      inputDuoRef.current?.focus();
      inputDuoRef.current?.select();
      return;
    }
    (e.currentTarget as HTMLInputElement).blur();
  };

  const handleDuoKeyDown: React.KeyboardEventHandler<HTMLInputElement> = async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    e.stopPropagation();
    await handleCommitDuo();
    (e.currentTarget as HTMLInputElement).blur();
  };

  return (
    <div
      className={`rounded-2xl border bg-[#F9F9F9] dark:bg-[#1E1E1E] p-6 shadow-2xl transition-all duration-500 ease-in-out hover:scale-[1.01] hover:border-[#3A3A3A] mb-4 ${
        isAlternativeActive ? 'border-amber-400/25' : 'border-zinc-300 dark:border-[#2A2A2A]'
      }`}
    >
      {isAlternativeActive ? (
        <span className="text-[10px] font-bold tracking-widest text-amber-400 uppercase bg-amber-400/10 px-2 py-1 rounded mb-2 inline-block">
          Modo Alternativo
        </span>
      ) : null}

      <div className="flex justify-between items-start mb-6 gap-4">
        <div className="min-w-0">
          <h2 className="text-[#FF8C00] font-extrabold text-xl mb-3 tracking-tight leading-snug break-words">
            {effectiveName}
          </h2>
          {stats ? (
            <div className="flex gap-4 items-baseline">
              <div>
                <p className="text-xs text-emerald-500 font-bold uppercase mb-1">Series</p>
                <p className="text-[#FF8C00] font-black text-2xl">{stats.sets}</p>
              </div>
              <div>
                <p className="text-xs text-emerald-500 font-bold uppercase mb-1">Reps</p>
                <p className="text-[#FF8C00] font-black text-2xl">{stats.reps}</p>
              </div>
            </div>
          ) : seriesReps ? (
            <p className="mt-2 text-sm font-semibold text-[#888888]">{seriesReps}</p>
          ) : null}
        </div>

        {hasVideo ? (
          <button
            type="button"
            onClick={() => setShowVideo(true)}
            className="h-11 w-11 flex items-center justify-center rounded-full bg-black/10 dark:bg-[#2A2A2A] text-emerald-500 dark:text-emerald-400 active:scale-95 transition-transform shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Ver video"
            title="Ver video"
          >
            <Play className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <div className={`grid gap-6 transition-all duration-300 ease-in-out ${showDuoColumn ? 'grid-cols-2' : 'grid-cols-1'}`}>
        <div className="transition-all duration-300">
          <span className="text-[10px] text-[#FF8C00] font-black uppercase shadow-sm tracking-tighter mb-1 block">TÚ</span>
          <div className="mt-2">
            <div
              className={`relative flex h-11 w-full items-center gap-3 border-b-2 bg-transparent transition-all duration-300 ease-in-out ${
                youStatus === 'success'
                  ? 'animate-[emeraldPulse_800ms_ease-in-out]'
                  : youStatus === 'saving'
                    ? 'border-emerald-400/40'
                    : savedFlash === 'you'
                      ? 'border-emerald-400/70'
                      : saveError
                        ? 'border-red-500/50'
                        : 'border-zinc-300 dark:border-[#2A2A2A] focus-within:border-emerald-400/70'
              }`}
            >
              <input
                ref={inputYouRef}
                inputMode="decimal"
                type="number"
                value={weightYou}
                onChange={(e) => onWeightYouChange(e.target.value)}
                onBlur={handleCommitYou}
                onKeyDown={handleYouKeyDown}
                placeholder="0"
                className={weightInputBaseClass}
              />
              <span className="text-xs font-normal text-[#888888]">kg</span>

              {youIsDirty ? (
                <button
                  type="button"
                  onClick={handleCommitYou}
                  aria-label="Guardar"
                  title="Guardar"
                  className={`pointer-events-auto absolute -top-3 -right-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-black shadow-[0_4px_10px_rgba(52,211,153,0.5)] transition-transform duration-150 active:scale-90 ${
                    youStatus === 'saving' ? 'opacity-60 cursor-wait' : 'opacity-100 scale-100'
                  }`}
                  disabled={youStatus === 'saving'}
                >
                  <Check className="h-4 w-4" />
                </button>
              ) : youHasCheck ? (
                <span className="pointer-events-none absolute -top-3 -right-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-black shadow-[0_4px_10px_rgba(52,211,153,0.35)] transition-transform duration-200">
                  <Check className="h-4 w-4" />
                </span>
              ) : null}
            </div>
            <span className="text-xs text-[#888888] mt-2 block">
              Anterior: <b className="text-[#FF8C00] dark:text-[#FF8C00]">{previousWeight.you ?? 0} kg</b>
            </span>
            {saving ? <p className="mt-1 text-[11px] text-zinc-500">Guardando...</p> : null}
          </div>
        </div>

        {showDuoColumn ? (
          <div className="transition-all duration-300 border-l border-zinc-300 dark:border-[#2A2A2A] pl-6">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-tighter mb-1 block">Dúo</span>
            <div className="mt-2">
              <div
                className={`relative flex h-11 w-full items-center gap-3 border-b-2 bg-transparent transition-all duration-300 ease-in-out ${
                  !duoEnabled
                    ? 'border-zinc-300 dark:border-[#2A2A2A] opacity-60'
                    : duoStatus === 'success'
                      ? 'animate-[emeraldPulse_800ms_ease-in-out]'
                      : duoStatus === 'saving'
                        ? 'border-emerald-400/40'
                        : savedFlash === 'duo'
                          ? 'border-emerald-400/70'
                          : saveErrorDuo
                            ? 'border-red-500/50'
                            : 'border-zinc-300 dark:border-[#2A2A2A] focus-within:border-emerald-400/70'
                }`}
              >
                <input
                  ref={inputDuoRef}
                  inputMode="decimal"
                  type="number"
                  value={weightDuo}
                  onChange={(e) => onWeightDuoChange?.(e.target.value)}
                  onBlur={handleCommitDuo}
                  onKeyDown={handleDuoKeyDown}
                  placeholder={duoEnabled ? '0' : '—'}
                  disabled={!duoEnabled}
                  className={`${weightInputBaseClass} ${!duoEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
                <span className="text-xs font-normal text-[#888888]">kg</span>

                {duoIsDirty && duoEnabled ? (
                  <button
                    type="button"
                    onClick={handleCommitDuo}
                    aria-label="Guardar"
                    title="Guardar"
                    className={`pointer-events-auto absolute -top-3 -right-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-black shadow-[0_4px_10px_rgba(52,211,153,0.5)] transition-transform duration-150 active:scale-90 ${
                      duoStatus === 'saving' ? 'opacity-60 cursor-wait' : 'opacity-100 scale-100'
                    }`}
                    disabled={duoStatus === 'saving'}
                  >
                    <Check className="h-4 w-4" />
                  </button>
                ) : duoHasCheck ? (
                  <span className="pointer-events-none absolute -top-3 -right-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-black shadow-[0_4px_10px_rgba(52,211,153,0.35)] transition-transform duration-200">
                    <Check className="h-4 w-4" />
                  </span>
                ) : null}
              </div>
              <span className="text-xs text-[#888888] mt-2 block">
                Anterior: <b className="text-[#FF8C00] dark:text-[#FF8C00]">{previousWeight.duo ?? 0} kg</b>
              </span>
              {savingDuo ? <p className="mt-1 text-[11px] text-zinc-500">Guardando...</p> : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-6 pt-4 border-t border-zinc-300 dark:border-[#2A2A2A] flex justify-end">
        <button
          type="button"
          onClick={handleToggleAlternative}
          disabled={!hasAlternative}
          style={
            isAlternativeActive
              ? {
                  backgroundColor: '#FF8C00',
                  color: '#FFFFFF',
                }
              : undefined
          }
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all duration-300 ease-in-out active:scale-95 ${
            !hasAlternative
              ? 'bg-black/10 dark:bg-[#2A2A2A] text-[#888888] opacity-60 cursor-not-allowed'
              : isAlternativeActive
                ? '!bg-[#FF8C00] !text-white font-black uppercase rounded-full px-6 py-2 shadow-lg shadow-orange-900/20 hover:brightness-110 active:scale-95 transition-all duration-300'
                : 'bg-black/10 dark:bg-[#2A2A2A] text-[#888888] hover:text-[#FF8C00] dark:hover:text-[#FF8C00]'
          }`}
          aria-label={isAlternativeActive ? 'Volver al ejercicio original' : 'Marcar máquina ocupada'}
          title={
            !hasAlternative
              ? 'No hay alternativa disponible'
              : isAlternativeActive
                ? 'Volver al original'
                : '¿Máquina ocupada?'
          }
        >
          <Clock className="h-4 w-4" />
          {isAlternativeActive ? 'MÁQUINA OCUPADA' : '¿MÁQUINA OCUPADA?'}
        </button>
      </div>

      {hasVideo ? (
        <VideoModal
          isOpen={showVideo}
          title={effectiveName}
          videoUrl={effectiveVideoUrl as string}
          onClose={() => setShowVideo(false)}
        />
      ) : null}
    </div>
  );
};
