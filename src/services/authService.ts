import { supabase } from './supabaseClient';
import type { UserSession, UserProfile } from '../types/auth';

const COUPLE_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const generateCoupleId = (length: number = 6): string => {
  const safeLength = Math.min(8, Math.max(6, length));
  let result = '';
  for (let i = 0; i < safeLength; i += 1) {
    result += COUPLE_ID_ALPHABET[Math.floor(Math.random() * COUPLE_ID_ALPHABET.length)];
  }
  return result;
};

export const signUp = async (email: string, password: string): Promise<UserSession> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) throw error;
  if (!data.user || !data.session) throw new Error('Sign up failed');

  return {
    id: data.user.id,
    email: data.user.email!,
    accessToken: data.session.access_token,
  };
};

export const signIn = async (email: string, password: string): Promise<UserSession> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  if (!data.user || !data.session) throw new Error('Sign in failed');

  return {
    id: data.user.id,
    email: data.user.email!,
    accessToken: data.session.access_token,
  };
};

export const signOut = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getProfile = async (userId: string): Promise<UserProfile> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, couple_id')
    .eq('id', userId)
    .single();

  if (error) throw error;
  if (!data) throw new Error('Profile not found');

  if (!data.couple_id) {
    return {
      ...data,
      couple_sessions: null,
    };
  }

  const { data: sessionData, error: sessionError } = await supabase
    .from('couple_sessions')
    .select('*')
    .eq('id', data.couple_id)
    .maybeSingle();

  if (sessionError) throw sessionError;

  return {
    ...data,
    couple_sessions: sessionData ?? null,
  };
};

export const getPartnerProfile = async ({
  coupleId,
  currentUserId,
}: {
  coupleId: string;
  currentUserId: string;
}): Promise<{ id: string; email: string } | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('couple_id', coupleId)
    .neq('id', currentUserId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as { id: string; email: string | null };
  if (!row.id) return null;

  return {
    id: row.id,
    email: row.email ?? '',
  };
};

export const updateProfileCoupleId = async (userId: string, coupleId: string): Promise<UserProfile> => {
  const normalized = coupleId.trim().toUpperCase();

  if (normalized.length < 6 || normalized.length > 8) {
    throw new Error('Invalid couple code');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ couple_id: normalized })
    .eq('id', userId)
    .select('id, email, couple_id')
    .single();

  if (error) throw error;
  if (!data) throw new Error('Profile not found');

  const { data: sessionData, error: sessionError } = await supabase
    .from('couple_sessions')
    .select('*')
    .eq('id', normalized)
    .maybeSingle();

  if (sessionError) throw sessionError;

  return {
    ...data,
    couple_sessions: sessionData ?? null,
  };
};

export const createNewCoupleGroup = async (userId: string): Promise<UserProfile> => {
  const coupleId = generateCoupleId(6);
  return updateProfileCoupleId(userId, coupleId);
};

export const joinCoupleGroup = async (userId: string, coupleId: string): Promise<UserProfile> => {
  return updateProfileCoupleId(userId, coupleId);
};

export const getCurrentSession = async (): Promise<UserSession | null> => {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) throw error;
  if (!session) return null;

  return {
    id: session.user.id,
    email: session.user.email!,
    accessToken: session.access_token,
  };
};
