import { supabase } from './supabaseClient';

interface SaveWeightParams {
  exerciseId: string;
  weight: number;
  userId: string;
  coupleId: string;
}

interface WorkoutLogRow {
  id: string;
  created_at: string;
  exercise_id: string;
  user_id: string;
  couple_id: string;
  weight_used: number;
}

interface ExerciseStatusRow {
  id: string;
  couple_id: string;
  exercise_id: string;
  is_alternative_active: boolean;
  updated_at: string;
}

export const saveWeight = async ({ exerciseId, weight, userId, coupleId }: SaveWeightParams): Promise<WorkoutLogRow> => {
  const { data, error } = await supabase
    .from('workout_logs')
    .insert({
      exercise_id: exerciseId,
      user_id: userId,
      couple_id: coupleId,
      weight_used: weight,
    })
    .select('*')
    .single();

  if (error) throw error;
  if (!data) throw new Error('No se pudo guardar el peso');

  return data as WorkoutLogRow;
};

export const getLastWeight = async ({
  exerciseId,
  userId,
  coupleId,
}: {
  exerciseId: string;
  userId: string;
  coupleId: string;
}): Promise<number | null> => {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('weight_used')
    .eq('exercise_id', exerciseId)
    .eq('user_id', userId)
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const w = (data as { weight_used: number | null }).weight_used;
  return typeof w === 'number' ? w : null;
};

export const getLastWeightsForExercise = async ({
  exerciseId,
  coupleId,
  currentUserId,
  partnerUserId,
}: {
  exerciseId: string;
  coupleId: string;
  currentUserId: string;
  partnerUserId?: string | null;
}): Promise<{ you: number | null; duo: number | null }> => {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('user_id, weight_used, created_at')
    .eq('exercise_id', exerciseId)
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw error;

  const rows = (data ?? []) as Array<{ user_id: string; weight_used: number; created_at: string }>;

  let you: number | null = null;
  let duo: number | null = null;

  for (const row of rows) {
    if (row.user_id === currentUserId) {
      if (you === null) you = row.weight_used;
      continue;
    }

    if (partnerUserId) {
      if (row.user_id === partnerUserId) {
        if (duo === null) duo = row.weight_used;
      }
    } else {
      if (duo === null) duo = row.weight_used;
    }

    if (you !== null && duo !== null) break;
  }

  return { you, duo };
};

export const getExerciseStatuses = async ({
  coupleId,
  exerciseIds,
}: {
  coupleId: string;
  exerciseIds?: string[];
}): Promise<Record<string, boolean>> => {
  let query = supabase
    .from('exercise_status')
    .select('exercise_id, is_alternative_active')
    .eq('couple_id', coupleId);

  if (exerciseIds && exerciseIds.length > 0) {
    query = query.in('exercise_id', exerciseIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Array<{ exercise_id: string; is_alternative_active: boolean | null }>;
  const map: Record<string, boolean> = {};

  for (const row of rows) {
    map[row.exercise_id] = Boolean(row.is_alternative_active);
  }

  return map;
};

export const setExerciseAlternativeActive = async ({
  coupleId,
  exerciseId,
  isAlternativeActive,
}: {
  coupleId: string;
  exerciseId: string;
  isAlternativeActive: boolean;
}): Promise<ExerciseStatusRow> => {
  const payload = {
    couple_id: coupleId,
    exercise_id: exerciseId,
    is_alternative_active: isAlternativeActive,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('exercise_status')
    .upsert(payload, { onConflict: 'couple_id,exercise_id' })
    .select('*')
    .single();

  if (error) throw error;
  if (!data) throw new Error('No se pudo actualizar el estado del ejercicio');

  return data as ExerciseStatusRow;
};
