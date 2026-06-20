import { WorkoutSession } from '../types/workout';
import { fetchWorkouts } from './api';

export const loadWorkoutHistory = async (): Promise<WorkoutSession[]> => {
  try {
    return await fetchWorkouts();
  } catch {
    return [];
  }
};
