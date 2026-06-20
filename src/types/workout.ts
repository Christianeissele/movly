export type WorkoutType = 'running' | 'cycling' | 'walking' | 'hiking' | 'other';

export interface WorkoutSession {
  id: string;
  type: WorkoutType;
  startTime: Date;
  endTime?: Date;
  duration: number; // seconds
  distance: number; // meters
  calories: number;
  avgHeartRate: number;
  maxHeartRate: number;
  route: RoutePoint[];
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  altitude: number;
  timestamp: Date;
  speed: number; // m/s
}

export interface LiveMetrics {
  heartRate: number;
  calories: number;
  distance: number;
  pace: number; // seconds per km
  duration: number; // seconds
  speed: number; // km/h
}
