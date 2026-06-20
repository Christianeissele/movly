import { WorkoutSession, WorkoutType } from '../types/workout';

const HK_TYPE_MAP: Record<number, WorkoutType> = {
  37: 'running', 13: 'cycling', 46: 'swimming', 63: 'tennis',
};

export const loadWorkoutHistory = async (): Promise<WorkoutSession[]> => {
  // 1. Volke DB via API
  try {
    const { fetchWorkouts } = await import('./api');
    return await fetchWorkouts();
  } catch {
    // API nicht erreichbar
  }

  // 2. HealthKit (Apple Watch — nur auf echtem iPhone)
  try {
    const HK = require('@kingstinct/react-native-healthkit').default;
    const workouts = await HK.queryWorkoutSamples({ limit: 50, ascending: false });
    return workouts.map((w: any) => ({
      id: w.uuid ?? String(Math.random()),
      type: HK_TYPE_MAP[w.workoutActivityType] ?? 'running',
      startTime: new Date(w.startDate),
      endTime: new Date(w.endDate),
      duration: (new Date(w.endDate).getTime() - new Date(w.startDate).getTime()) / 1000,
      distance: (w.totalDistance?.quantity ?? 0) * 1000,
      calories: w.totalEnergyBurned?.quantity ?? 0,
      avgHeartRate: 0, maxHeartRate: 0, route: [],
    }));
  } catch {
    return [];
  }
};
