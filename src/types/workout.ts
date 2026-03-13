export type Phase = 1 | 2 | 3 | 4;

export interface Exercise {
  id: string;
  nombre: string;
  video_url: string;
  dia: string;
  fase: number;
  series_reps: string;
  nombre_alternativa: string;
  video_url_alternativa: string;
}

export interface WorkoutLog {
  id?: string;
  user_id: string;
  exercise_id: string;
  weight_used: number;
  completed_at: string;
  is_alternative: boolean;
}

export interface CoupleSession {
  id: string;
  couple_id?: string | null;
  spreadsheet_id?: string | null;
  is_active?: boolean;
  owner_id?: string;
  current_phase: Phase;
  current_day: number;
  active_exercise_index: number;
  is_busy_mode: boolean;
  updated_at: string;
}
