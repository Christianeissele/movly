import { WorkoutSession, WorkoutType } from '../types/workout';

const getHK = () => {
  try { return require('@kingstinct/react-native-healthkit').default; }
  catch { return null; }
};

const HR_ID     = 'HKQuantityTypeIdentifierHeartRate';
const ENERGY_ID = 'HKQuantityTypeIdentifierActiveEnergyBurned';
const DIST_RUN  = 'HKQuantityTypeIdentifierDistanceWalkingRunning';
const DIST_BIKE = 'HKQuantityTypeIdentifierDistanceCycling';
const STEPS_ID  = 'HKQuantityTypeIdentifierStepCount';
// HKWorkoutTypeIdentifier is NOT passed to requestAuthorization — it crashes the native module

const HK_ACTIVITY: Record<number, WorkoutType> = {
  37: 'running', 13: 'cycling', 46: 'swimming', 62: 'tennis', 63: 'tennis',
};

export const initHealthKit = async () => {
  const HK = getHK();
  if (!HK) throw new Error('HealthKit not available');
  await HK.requestAuthorization({
    toRead: [HR_ID, ENERGY_ID, DIST_RUN, DIST_BIKE, STEPS_ID],
  });
};

export const getLatestHeartRate = async (): Promise<number> => {
  try {
    const HK = getHK();
    if (!HK) return 0;
    const s = await HK.queryQuantitySamples(HR_ID, { limit: 1, ascending: false });
    return s?.[0]?.quantity ?? 0;
  } catch { return 0; }
};

export const getHeartRateSamples = async (from: Date, to: Date) => {
  try {
    const HK = getHK();
    if (!HK) return [];
    const s = await HK.queryQuantitySamples(HR_ID, { from, to, ascending: true, limit: 1000 });
    return (s ?? []).map((x: any) => ({ value: x.quantity, startDate: x.startDate }));
  } catch { return []; }
};

export const getDailySteps = async (date: Date): Promise<number> => {
  try {
    const HK = getHK();
    if (!HK) return 0;
    const from = new Date(date); from.setHours(0, 0, 0, 0);
    const to   = new Date(date); to.setHours(23, 59, 59, 999);
    const s = await HK.queryQuantitySamples(STEPS_ID, { from, to, ascending: true });
    return Math.round((s ?? []).reduce((sum: number, x: any) => sum + x.quantity, 0));
  } catch { return 0; }
};

export const getWeeklySteps = async (): Promise<number[]> => {
  const days: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    days.push(await getDailySteps(d));
  }
  return days;
};

export const importHealthKitWorkouts = async (): Promise<WorkoutSession[]> => {
  const HK = getHK();
  if (!HK) return [];
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 3600 * 1000);
  const samples = await HK.queryWorkoutSamples({ from: oneYearAgo, to: new Date(), ascending: false, limit: 500 });
  return (samples ?? [])
    .filter((s: any) => HK_ACTIVITY[s.workoutActivityType])
    .map((s: any) => ({
      id: s.uuid ?? '',
      type: HK_ACTIVITY[s.workoutActivityType],
      startTime: new Date(s.startDate),
      endTime:   new Date(s.endDate),
      duration:  s.duration ?? 0,
      movingTime: s.duration ?? 0,
      distance:  (s.totalDistance?.quantity ?? 0) * 1000,
      calories:  s.totalEnergyBurned?.quantity ?? 0,
      avgHeartRate: 0, maxHeartRate: 0, maxSpeed: 0,
      elevGain: 0, elevLoss: 0, route: [],
    }));
};
