import { useState } from 'react';
import { ArrowRight, Users, Loader2, Dumbbell } from 'lucide-react';

interface CoupleOnboardingProps {
  email: string;
  currentCoupleId: string | null;
  isLoading: boolean;
  error: string | null;
  onCreateNew: () => Promise<unknown>;
  onJoinExisting: (code: string) => Promise<unknown>;
}

export const CoupleOnboarding = ({
  email,
  currentCoupleId,
  isLoading,
  error,
  onCreateNew,
  onJoinExisting,
}: CoupleOnboardingProps) => {
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleJoin = async () => {
    const normalized = code.trim().toUpperCase();

    if (!normalized) {
      setLocalError('Introduce un código');
      return;
    }

    if (normalized.length < 6 || normalized.length > 8) {
      setLocalError('El código debe tener 6 a 8 caracteres');
      return;
    }

    setLocalError(null);
    await onJoinExisting(normalized);
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-[#FF8C00] dark:text-[#FF8C00]">
          <Dumbbell className="w-6 h-6 text-emerald-500" />
          <h1 className="text-2xl font-black tracking-tighter">Vincula tu pareja</h1>
        </div>
        <p className="text-sm text-[#888888] mt-2">
          Sesión: <span className="text-[#FF8C00] dark:text-[#FF8C00] font-semibold">{email}</span>
        </p>
      </div>

      {(localError || error) && (
        <div className="mb-4 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-800">
          {localError || error}
        </div>
      )}

      {currentCoupleId ? (
        <div className="rounded-2xl border border-zinc-300 bg-white p-5">
          <p className="text-sm text-[#888888]">Tu código de pareja</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-3xl font-black tracking-widest text-[#FF8C00] dark:text-[#FF8C00]">{currentCoupleId}</p>
            <Users className="w-6 h-6 text-emerald-500" />
          </div>
          <p className="text-xs text-[#888888] mt-3">
            Compártelo con tu pareja para que se una.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            disabled={isLoading}
            onClick={onCreateNew}
            className="w-full rounded-2xl bg-[#FF8C00] text-white font-black uppercase tracking-tighter py-4 hover:bg-[#E67E00] active:scale-95 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" />}
            Crear nuevo grupo
            <ArrowRight className="w-5 h-5" />
          </button>

          <div className="rounded-2xl border border-zinc-300 bg-white p-5">
            <p className="text-sm text-[#FF8C00] dark:text-[#FF8C00] font-black tracking-tighter mb-3">Unirse a pareja</p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-2xl bg-white border border-zinc-300 px-4 py-3 text-[#121212] placeholder:text-[#888888] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Código (ej. AB12CD)"
              autoCapitalize="characters"
              autoCorrect="off"
            />
            <button
              type="button"
              disabled={isLoading}
              onClick={handleJoin}
              className="mt-3 w-full rounded-2xl bg-[#FF8C00] text-white font-black uppercase tracking-tighter py-3 hover:bg-[#E67E00] active:scale-95 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
              Unirme
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
