export type WorkoutType = 'running' | 'cycling' | 'swimming' | 'tennis';
export type HRZone = 0 | 1 | 2 | 3 | 4 | 5;

export const HR_ZONE_COLORS: Record<HRZone, string> = {
  0: '#636366', 1: '#8E8E93', 2: '#30D158', 3: '#0A84FF', 4: '#FF9F0A', 5: '#FF3B30',
};
export const HR_ZONE_LABELS: Record<HRZone, string> = {
  0: '—', 1: 'Recovery', 2: 'Aerob', 3: 'Tempo', 4: 'Schwelle', 5: 'Maximal',
};

export const getHRZone = (hr: number, maxHR = 190): HRZone => {
  if (!hr) return 0;
  const p = hr / maxHR;
  if (p < 0.60) return 1;
  if (p < 0.70) return 2;
  if (p < 0.80) return 3;
  if (p < 0.90) return 4;
  return 5;
};

export interface LiveMetrics {
  heartRate: number;
  maxHeartRate: number;
  hrZone: HRZone;
  calories: number;
  distance: number;
  pace: number;
  duration: number;
  movingTime: number;
  speed: number;
  avgSpeed: number;
  maxSpeed: number;
  altitude: number;
  elevGain: number;
  elevLoss: number;
  isPaused: boolean;
}

export interface WorkoutSession {
  id: string;
  type: WorkoutType;
  startTime: Date;
  endTime?: Date;
  duration: number;
  movingTime: number;
  distance: number;
  calories: number;
  avgHeartRate: number;
  maxHeartRate: number;
  maxSpeed: number;
  elevGain: number;
  elevLoss: number;
  notes?: string;
  feeling?: number; // 1–5
  route: RoutePoint[];
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  altitude: number;
  timestamp: Date;
  speed: number;
}
