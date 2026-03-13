export type TrainingPhase = 1 | 2 | 3 | 4;

export interface Exercise {
  id: string;
  order: number;
  primaryName: string;
  primaryVideoUrl: string;
  secondaryName: string;
  secondaryVideoUrl: string;
  series: number;
  reps: number;
  lastWeightU1: number;
  lastWeightU2: number;
}

export interface CoupleState {
  coupleId: string;
  currentPhase: TrainingPhase;
  activeExerciseIndex: number;
  isBusyToggleActive: boolean;
}
