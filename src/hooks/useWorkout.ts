import { useState, useEffect, useRef, useCallback } from 'react';
import { LiveMetrics, RoutePoint, WorkoutType } from '../types/workout';
import { getLatestHeartRate } from '../services/healthkit';
// HR polling via HealthKit (Apple Watch writes samples every ~5s)
import { startLocationTracking, calculateDistance } from '../services/gps';
import * as Location from 'expo-location';

export const useWorkout = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [metrics, setMetrics] = useState<LiveMetrics>({
    heartRate: 0,
    calories: 0,
    distance: 0,
    pace: 0,
    duration: 0,
    speed: 0,
  });
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [workoutType, setWorkoutType] = useState<WorkoutType>('running');

  const startTime = useRef<Date | null>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const hrInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const routeRef = useRef<RoutePoint[]>([]);

  const startWorkout = useCallback(async (type: WorkoutType) => {
    setWorkoutType(type);
    setRoute([]);
    routeRef.current = [];
    startTime.current = new Date();
    setIsRunning(true);

    // GPS tracking
    locationSub.current = await startLocationTracking((point) => {
      routeRef.current = [...routeRef.current, point];
      setRoute([...routeRef.current]);
      const dist = calculateDistance(routeRef.current);
      const elapsed = (Date.now() - startTime.current!.getTime()) / 1000;
      const speedMs = point.speed;
      const speedKmh = speedMs * 3.6;
      const paceSecPerKm = speedMs > 0.5 ? 1000 / speedMs : 0;
      // ~1 kcal per 80kg per 1m distance (rough estimate)
      const kcal = (dist * 80) / 1000;

      setMetrics((prev) => ({
        ...prev,
        distance: dist,
        speed: speedKmh,
        pace: paceSecPerKm,
        calories: kcal,
        duration: elapsed,
      }));
    });

    // Heart rate polling from HealthKit (Apple Watch updates every ~5s)
    hrInterval.current = setInterval(async () => {
      const hr = await getLatestHeartRate();
      if (hr > 0) setMetrics((prev) => ({ ...prev, heartRate: hr }));
    }, 5000);

    // Timer
    timerInterval.current = setInterval(() => {
      if (startTime.current) {
        const elapsed = (Date.now() - startTime.current.getTime()) / 1000;
        setMetrics((prev) => ({ ...prev, duration: elapsed }));
      }
    }, 1000);
  }, []);

  const stopWorkout = useCallback(() => {
    setIsRunning(false);
    locationSub.current?.remove();
    if (hrInterval.current) clearInterval(hrInterval.current);
    if (timerInterval.current) clearInterval(timerInterval.current);
    startTime.current = null;
  }, []);

  useEffect(() => {
    return () => {
      locationSub.current?.remove();
      if (hrInterval.current) clearInterval(hrInterval.current);
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, []);

  return { isRunning, metrics, route, workoutType, startWorkout, stopWorkout };
};
