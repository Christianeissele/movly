import { useState, useEffect, useRef, useCallback } from 'react';
import { LiveMetrics, RoutePoint, WorkoutSession, WorkoutType } from '../types/workout';
import { getLatestHeartRate } from '../services/healthkit';
import { startLocationTracking, calculateDistance } from '../services/gps';
import { saveWorkout } from '../services/api';
import * as Location from 'expo-location';

export const useWorkout = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [metrics, setMetrics] = useState<LiveMetrics>({
    heartRate: 0, calories: 0, distance: 0, pace: 0, duration: 0, speed: 0,
  });
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [workoutType, setWorkoutType] = useState<WorkoutType>('running');

  const startTime = useRef<Date | null>(null);
  const locationSub = useRef<Location.LocationSubscription | null>(null);
  const hrInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const routeRef = useRef<RoutePoint[]>([]);
  const metricsRef = useRef<LiveMetrics>(metrics);

  const startWorkout = useCallback(async (type: WorkoutType) => {
    setWorkoutType(type);
    setRoute([]);
    routeRef.current = [];
    startTime.current = new Date();
    setIsRunning(true);

    locationSub.current = await startLocationTracking((point) => {
      routeRef.current = [...routeRef.current, point];
      setRoute([...routeRef.current]);
      const dist = calculateDistance(routeRef.current);
      const elapsed = (Date.now() - startTime.current!.getTime()) / 1000;
      const speedMs = point.speed;
      const updated: LiveMetrics = {
        ...metricsRef.current,
        distance: dist,
        speed: speedMs * 3.6,
        pace: speedMs > 0.5 ? 1000 / speedMs : 0,
        calories: (dist * 80) / 1000,
        duration: elapsed,
      };
      metricsRef.current = updated;
      setMetrics(updated);
    });

    hrInterval.current = setInterval(async () => {
      const hr = await getLatestHeartRate();
      if (hr > 0) {
        metricsRef.current = { ...metricsRef.current, heartRate: hr };
        setMetrics(prev => ({ ...prev, heartRate: hr }));
      }
    }, 5000);

    timerInterval.current = setInterval(() => {
      if (startTime.current) {
        const elapsed = (Date.now() - startTime.current.getTime()) / 1000;
        setMetrics(prev => ({ ...prev, duration: elapsed }));
      }
    }, 1000);
  }, []);

  const stopWorkout = useCallback(async () => {
    const endTime = new Date();
    const finalMetrics = metricsRef.current;
    const finalRoute = [...routeRef.current];
    const type = workoutType;
    const start = startTime.current!;

    setIsRunning(false);
    locationSub.current?.remove();
    if (hrInterval.current) clearInterval(hrInterval.current);
    if (timerInterval.current) clearInterval(timerInterval.current);
    startTime.current = null;

    // Save to Volke DB via API
    setIsSaving(true);
    try {
      const session: WorkoutSession = {
        id: '',
        type,
        startTime: start,
        endTime,
        duration: finalMetrics.duration,
        distance: finalMetrics.distance,
        calories: finalMetrics.calories,
        avgHeartRate: finalMetrics.heartRate,
        maxHeartRate: finalMetrics.heartRate,
        route: finalRoute,
      };
      await saveWorkout(session);
    } catch (e) {
      console.warn('Workout konnte nicht gespeichert werden:', e);
    } finally {
      setIsSaving(false);
    }
  }, [workoutType]);

  useEffect(() => {
    return () => {
      locationSub.current?.remove();
      if (hrInterval.current) clearInterval(hrInterval.current);
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, []);

  return { isRunning, isSaving, metrics, route, workoutType, startWorkout, stopWorkout };
};
