import type { ReactNode } from 'react';

const DAYS: Array<{ key: string; label: string; short: string }> = [
  { key: 'lunes', label: 'Lunes', short: 'L' },
  { key: 'martes', label: 'Martes', short: 'M' },
  { key: 'miércoles', label: 'Miércoles', short: 'X' },
  { key: 'jueves', label: 'Jueves', short: 'J' },
  { key: 'viernes', label: 'Viernes', short: 'V' },
  { key: 'sábado', label: 'Sábado', short: 'S' },
  { key: 'domingo', label: 'Domingo', short: 'D' },
];

interface DaySelectorProps {
  selectedDay: string | null;
  onChange: (day: string) => void;
  disabled?: boolean;
}

export const DaySelector = ({ selectedDay, onChange, disabled }: DaySelectorProps): ReactNode => {
  return (
    <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
      {DAYS.map((day) => {
        const isActive = selectedDay === day.label;

        return (
          <button
            key={day.key}
            type="button"
            disabled={disabled}
            onClick={() => onChange(day.label)}
            className={`shrink-0 h-11 min-w-11 rounded-full px-4 border transition-all duration-200 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              isActive
                ? 'text-white font-bold border-emerald-400 bg-[#2A2A2A] shadow-[0_0_15px_rgba(52,211,153,0.1)]'
                : 'text-[#888888] font-normal border-[#2A2A2A] bg-transparent hover:bg-[#1E1E1E]'
            }`}
            title={day.label}
          >
            {day.short}
          </button>
        );
      })}
    </div>
  );
};
