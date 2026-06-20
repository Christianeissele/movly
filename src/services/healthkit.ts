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

export const initHealthKit = async (): Promise<void> => {
  const HK = getHK();
  if (!HK) throw new Error('HealthKit not available (Simulator)');
  await HK.requestAuthorization(
    [HR_IDENTIFIER, ENERGY_IDENTIFIER, DISTANCE_RUN_IDENTIFIER, DISTANCE_CYCLE_IDENTIFIER],
    [ENERGY_IDENTIFIER]
  );
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
