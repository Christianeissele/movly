import { WorkoutSession, WorkoutType } from '../types/workout';

const HK_TYPE_MAP: Record<number, WorkoutType> = {
  37: 'running',
  13: 'cycling',
  52: 'walking',
  24: 'hiking',
};

export const loadWorkoutHistory = async (): Promise<WorkoutSession[]> => {
  // 1. API (Volke DB) — Quelle der Wahrheit
  try {
    const { fetchWorkouts } = await import('./api');
    const apiWorkouts = await fetchWorkouts();
    if (apiWorkouts.length > 0) return apiWorkouts;
  } catch {
    // API nicht erreichbar — weiter zu HealthKit
  }

  // 2. HealthKit — vergangene Trainings von Apple Watch
  try {
    const HK = require('@kingstinct/react-native-healthkit').default;
    const workouts = await HK.queryWorkoutSamples({ limit: 50, ascending: false });
    return workouts.map((w: any) => ({
      id: w.uuid ?? String(Math.random()),
      type: HK_TYPE_MAP[w.workoutActivityType] ?? 'other',
      startTime: new Date(w.startDate),
      endTime: new Date(w.endDate),
      duration: (new Date(w.endDate).getTime() - new Date(w.startDate).getTime()) / 1000,
      distance: (w.totalDistance?.quantity ?? 0) * 1000,
      calories: w.totalEnergyBurned?.quantity ?? 0,
      avgHeartRate: 0,
      maxHeartRate: 0,
      route: [],
    }));
  } catch {
    return getMockWorkouts();
  }
};

export const getMockWorkouts = (): WorkoutSession[] => [
  {
    id: '1', type: 'running',
    startTime: new Date(Date.now() - 86400000),
    endTime: new Date(Date.now() - 86400000 + 2100000),
    duration: 2100, distance: 5200, calories: 412, avgHeartRate: 158, maxHeartRate: 178, route: [],
  },
  {
    id: '2', type: 'cycling',
    startTime: new Date(Date.now() - 3 * 86400000),
    endTime: new Date(Date.now() - 3 * 86400000 + 3900000),
    duration: 3900, distance: 22400, calories: 680, avgHeartRate: 142, maxHeartRate: 165, route: [],
  },
  {
    id: '3', type: 'running',
    startTime: new Date(Date.now() - 5 * 86400000),
    endTime: new Date(Date.now() - 5 * 86400000 + 3000000),
    duration: 3000, distance: 7800, calories: 590, avgHeartRate: 162, maxHeartRate: 182, route: [],
  },
];
