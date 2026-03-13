import { useMemo, useState } from 'react';
import { LoginForm } from './LoginForm';
import { CoupleOnboarding } from './CoupleOnboarding';
import { ThemeToggle } from '../../ThemeToggle';
import type { UserProfile } from '../../../types/auth';

type ViewMode = 'login' | 'register' | 'couple-link';

interface AuthViewProps {
  userEmail: string | null;
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
  onCreateCouple: () => Promise<unknown>;
  onJoinCouple: (code: string) => Promise<unknown>;
}

export const AuthView = ({
  userEmail,
  profile,
  isLoading,
  error,
  onLogin,
  onRegister,
  onCreateCouple,
  onJoinCouple,
}: AuthViewProps) => {
  const initialMode = useMemo<ViewMode>(() => {
    if (userEmail && profile && !profile.couple_id) return 'couple-link';
    return 'login';
  }, [userEmail, profile]);

  const [mode, setMode] = useState<ViewMode>(initialMode);

  const showCoupleOnboarding = Boolean(userEmail && profile && !profile.couple_id);
  const activeMode: ViewMode = showCoupleOnboarding ? 'couple-link' : mode;

  return (
    <div className="relative min-h-screen bg-[#121212] dark:bg-black text-white px-6 py-10 flex flex-col transition-all duration-500 ease-in-out">
      <ThemeToggle />
      <div className="text-center">
        <h1 className="text-4xl tracking-tighter">
          <span className="text-[#FF8C00] font-black">POWER</span>{' '}
          <span className="text-emerald-500 font-medium">DUO</span>
        </h1>
        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[#888888]">Acceso seguro</p>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="rounded-[2.5rem] border-4 border-[#34D399] bg-[#F9F9F9] dark:bg-[#1E1E1E] p-10 text-black dark:text-white shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-500 ease-in-out">
            <div className="transition-opacity duration-200 ease-out">
              {activeMode === 'couple-link' ? (
                <CoupleOnboarding
                  email={userEmail ?? ''}
                  currentCoupleId={profile?.couple_id ?? null}
                  isLoading={isLoading}
                  error={error}
                  onCreateNew={onCreateCouple}
                  onJoinExisting={onJoinCouple}
                />
              ) : (
                <LoginForm
                  mode={activeMode}
                  isLoading={isLoading}
                  error={error}
                  onSubmit={activeMode === 'login' ? onLogin : onRegister}
                  onModeChange={(next) => setMode(next)}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-[#888888]">Irapuato • 2026</p>
    </div>
  );
};
