export interface UserSession {
  id: string;
  email: string;
  accessToken: string;
}

export interface CoupleSession {
  id: string;
  spreadsheet_id: string | null;
  current_phase: number;
  is_busy_mode: boolean;
}

export interface UserProfile {
  id: string;
  email: string;
  couple_id: string | null;
  couple_sessions?: CoupleSession | CoupleSession[] | null;
}
