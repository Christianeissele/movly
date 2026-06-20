import { WorkoutSession, WorkoutType } from '../types/workout';

// Lazy-load HealthKit so the Simulator doesn't crash on import
const getHK = () => {
  try {
    return require('@kingstinct/react-native-healthkit').default;
  } catch {
    return null;
  }
};

// Numeric identifiers — avoids importing enums that are undefined in Simulator
const HR_IDENTIFIER = 'HKQuantityTypeIdentifierHeartRate';
const ENERGY_IDENTIFIER = 'HKQuantityTypeIdentifierActiveEnergyBurned';
const DISTANCE_RUN_IDENTIFIER = 'HKQuantityTypeIdentifierDistanceWalkingRunning';
const DISTANCE_CYCLE_IDENTIFIER = 'HKQuantityTypeIdentifierDistanceCycling';
const WORKOUT_IDENTIFIER = 'HKWorkoutTypeIdentifier';

// HKWorkoutActivityType numeric values
const HK_ACTIVITY: Record<number, WorkoutType> = {
  37: 'running',
  13: 'cycling',
  46: 'swimming',
  62: 'tennis',
};

export const initHealthKit = async (): Promise<void> => {
  const HK = getHK();
  if (!HK) throw new Error('HealthKit not available (Simulator)');
  await HK.requestAuthorization(
    [HR_IDENTIFIER, ENERGY_IDENTIFIER, DISTANCE_RUN_IDENTIFIER, DISTANCE_CYCLE_IDENTIFIER, WORKOUT_IDENTIFIER],
    [ENERGY_IDENTIFIER]
  );
};

export const importHealthKitWorkouts = async (): Promise<WorkoutSession[]> => {
  const HK = getHK();
  if (!HK) return [];
  // Request workout read permission
  await HK.requestAuthorization(
    [HR_IDENTIFIER, ENERGY_IDENTIFIER, DISTANCE_RUN_IDENTIFIER, DISTANCE_CYCLE_IDENTIFIER, WORKOUT_IDENTIFIER],
    []
  );
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 3600 * 1000);
  const samples = await HK.queryWorkoutSamples({
    from: oneYearAgo,
    to: new Date(),
    ascending: false,
    limit: 500,
  });
  const results: WorkoutSession[] = [];
  for (const s of samples ?? []) {
    const type = HK_ACTIVITY[s.workoutActivityType];
    if (!type) continue; // skip unsupported activities
    results.push({
      id: s.uuid ?? '',
      type,
      startTime: new Date(s.startDate),
      endTime:   new Date(s.endDate),
      duration:  s.duration ?? 0,
      distance:  s.totalDistance?.quantity ?? 0,
      calories:  s.totalEnergyBurned?.quantity ?? 0,
      avgHeartRate: 0,
      maxHeartRate: 0,
      route: [],
    });
  }
  return results;
};

export const getLatestHeartRate = async (): Promise<number> => {
  try {
    const HK = getHK();
    if (!HK) return 0;
    const samples = await HK.queryQuantitySamples(HR_IDENTIFIER, {
      limit: 1,
      ascending: false,
    });
    return samples?.[0]?.quantity ?? 0;
  } catch {
    return 0;
  }
};

export const getHeartRateSamples = async (
  startDate: Date,
  endDate: Date
): Promise<{ value: number; startDate: string }[]> => {
  try {
    const HK = getHK();
    if (!HK) return [];
    const samples = await HK.queryQuantitySamples(HR_IDENTIFIER, {
      from: startDate,
      to: endDate,
      ascending: true,
      limit: 1000,
    });
    return (samples ?? []).map((s: any) => ({
      value: s.quantity,
      startDate: s.startDate,
    }));
  } catch {
    return [];
  }
};
