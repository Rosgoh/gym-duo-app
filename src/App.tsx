import { Loader2 } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { AuthView } from './components/features/Auth/AuthView';
import { MainWorkoutView } from './components/MainWorkoutView';

function App() {
  const {
    user,
    profile,
    sessionData,
    isLoading,
    error,
    signIn,
    signUp,
    signOut,
    createCouple,
    joinCouple,
    needsCoupleOnboarding,
  } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-white animate-spin mx-auto mb-4" />
          <p className="text-white text-lg font-semibold">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthView
        userEmail={null}
        profile={null}
        isLoading={isLoading}
        error={error}
        onLogin={signIn}
        onRegister={signUp}
        onCreateCouple={createCouple}
        onJoinCouple={joinCouple}
      />
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-white animate-spin mx-auto mb-4" />
          <p className="text-white text-lg font-semibold">Cargando perfil...</p>
        </div>
      </div>
    );
  }

  if (needsCoupleOnboarding) {
    return (
      <AuthView
        userEmail={user.email ?? null}
        profile={profile}
        isLoading={isLoading}
        error={error}
        onLogin={signIn}
        onRegister={signUp}
        onCreateCouple={createCouple}
        onJoinCouple={joinCouple}
      />
    );
  }

  return <MainWorkoutView profile={profile} sessionData={sessionData} onSignOut={signOut} />;
}

export default App;
