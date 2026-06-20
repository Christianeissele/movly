import { WorkoutSession, WorkoutType } from '../types/workout';

// Numeric constants from HKWorkoutActivityType (stable Apple values, no import needed)
const HK_TYPE_MAP: Record<number, WorkoutType> = {
  37: 'running',
  13: 'cycling',
  52: 'walking',
  24: 'hiking',
};

export const loadWorkoutHistory = async (): Promise<WorkoutSession[]> => {
  try {
    const HealthKit = require('@kingstinct/react-native-healthkit').default;
    const workouts = await HealthKit.queryWorkoutSamples({
      limit: 50,
      ascending: false,
    });

    return workouts.map((w: any) => ({
      id: w.uuid ?? String(Math.random()),
      type: HK_TYPE_MAP[w.workoutActivityType as HKWorkoutActivityType] ?? 'other',
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
    id: '1',
    type: 'running',
    startTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 35 * 60 * 1000),
    duration: 2100,
    distance: 5200,
    calories: 412,
    avgHeartRate: 158,
    maxHeartRate: 178,
    route: [],
  },
  {
    id: '2',
    type: 'cycling',
    startTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 65 * 60 * 1000),
    duration: 3900,
    distance: 22400,
    calories: 680,
    avgHeartRate: 142,
    maxHeartRate: 165,
    route: [],
  },
  {
    id: '3',
    type: 'running',
    startTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 + 50 * 60 * 1000),
    duration: 3000,
    distance: 7800,
    calories: 590,
    avgHeartRate: 162,
    maxHeartRate: 182,
    route: [],
  },
  {
    id: '4',
    type: 'hiking',
    startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 120 * 60 * 1000),
    duration: 7200,
    distance: 9100,
    calories: 820,
    avgHeartRate: 125,
    maxHeartRate: 148,
    route: [],
  },
];
