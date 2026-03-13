import { useMemo, useState } from 'react';
import { ArrowRight, Lock, Mail, UserPlus, LogIn, Loader2 } from 'lucide-react';
import { validateForm } from './validateForm';

type Mode = 'login' | 'register';

interface LoginFormProps {
  mode: Mode;
  isLoading: boolean;
  error: string | null;
  onSubmit: (email: string, password: string) => Promise<void>;
  onModeChange: (mode: Mode) => void;
}

export const LoginForm = ({ mode, isLoading, error, onSubmit, onModeChange }: LoginFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const title = useMemo(() => (mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'), [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm({ mode, email, password });
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setLocalError(null);
    await onSubmit(email.trim(), password);
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tighter text-[#FF8C00] dark:text-[#FF8C00]">{title}</h1>
        <p className="text-sm text-[#888888] mt-1">Acceso de alto rendimiento</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-[#FF8C00] dark:text-[#FF8C00] mb-2">Correo</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#888888]" />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              inputMode="email"
              autoComplete="email"
              className="w-full rounded-2xl bg-white border border-zinc-300 pl-11 pr-4 py-3 text-[#121212] placeholder:text-[#888888] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="tu@email.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#FF8C00] dark:text-[#FF8C00] mb-2">Contraseña</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#888888]" />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="w-full rounded-2xl bg-white border border-zinc-300 pl-11 pr-4 py-3 text-[#121212] placeholder:text-[#888888] focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="••••••••"
            />
          </div>
        </div>

        {(localError || error) && (
          <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-800">
            {localError || error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-2xl bg-[#FF8C00] text-white font-black uppercase tracking-tighter py-4 hover:bg-[#E67E00] active:scale-95 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Procesando...
            </>
          ) : (
            <>
              {mode === 'login' ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
              {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => onModeChange(mode === 'login' ? 'register' : 'login')}
          className="w-full text-sm font-semibold text-[#888888] hover:text-[#FF8C00]"
        >
          {mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
        </button>
      </form>
    </div>
  );
};
