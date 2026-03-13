export type AuthMode = 'login' | 'register';

interface ValidateFormInput {
  mode: AuthMode;
  email: string;
  password: string;
}

export const validateForm = ({ mode, email, password }: ValidateFormInput): string | null => {
  const trimmedEmail = email.trim();

  if (!trimmedEmail) return 'El email es obligatorio';
  if (!trimmedEmail.includes('@')) return 'Email inválido';

  if (!password) return 'La contraseña es obligatoria';
  if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres';

  if (mode !== 'login' && mode !== 'register') return 'Modo inválido';

  return null;
};
