import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../theme/ThemeContext';

type ThemeToggleProps = {
  placement?: 'floating' | 'inline';
  className?: string;
};

export const ThemeToggle = ({ placement = 'floating', className }: ThemeToggleProps) => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  const baseClassName =
    'p-2 rounded-full border border-emerald-500/30 backdrop-blur-md transition-all duration-500 ease-in-out active:scale-90 bg-black/20 dark:bg-white/5';

  const floatingClassName = 'absolute right-6 top-6 z-50';
  const inlineClassName = 'relative';

  const resolvedPlacementClassName = placement === 'floating' ? floatingClassName : inlineClassName;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className={[resolvedPlacementClassName, baseClassName, className].filter(Boolean).join(' ')}
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-[#FF8C00]" />
      ) : (
        <Moon className="w-5 h-5 text-emerald-500" />
      )}
    </button>
  );
};
