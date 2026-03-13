import type { ReactNode } from 'react';

interface PhaseSelectorProps {
  activePhase: number;
  onChange: (phase: number) => void | Promise<void>;
  disabled?: boolean;
}

export const PhaseSelector = ({ activePhase, onChange, disabled }: PhaseSelectorProps): ReactNode => {
  const phases = [1, 2, 3, 4];

  return (
    <div className="inline-flex rounded-xl bg-[#1E1E1E] p-1 border border-[#2A2A2A]">
      {phases.map((phase) => {
        const isActive = phase === activePhase;

        return (
          <button
            key={phase}
            type="button"
            disabled={disabled}
            onClick={() => onChange(phase)}
            className={`h-11 px-4 text-xs rounded-lg transition-all duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-60 disabled:cursor-not-allowed border ${
              isActive
                ? 'text-white font-bold border-emerald-400 bg-[#2A2A2A] shadow-[0_0_15px_rgba(52,211,153,0.1)]'
                : 'text-[#888888] font-normal border-transparent hover:bg-[#2A2A2A]'
            }`}
          >
            Rutina {phase}
          </button>
        );
      })}
    </div>
  );
};
