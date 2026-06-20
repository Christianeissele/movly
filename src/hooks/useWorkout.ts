import { useState, useEffect, useRef, useCallback } from 'react';
import { LiveMetrics, RoutePoint, WorkoutSession, WorkoutType, getHRZone } from '../types/workout';
import { getLatestHeartRate } from '../services/healthkit';
import { startLocationTracking, calculateDistance } from '../services/gps';
import { saveWorkout } from '../services/api';
import * as Location from 'expo-location';

const PAUSE_THRESHOLD_MS = 0.5;  // m/s — slower than this = auto-pause
const RESUME_THRESHOLD_MS = 0.8; // m/s — faster than this = auto-resume
const ALT_NOISE_FILTER = 4;      // meters — ignore altitude changes below this

const EMPTY_METRICS: LiveMetrics = {
  heartRate: 0, maxHeartRate: 0, hrZone: 0, calories: 0, distance: 0,
  pace: 0, duration: 0, movingTime: 0, speed: 0, avgSpeed: 0, maxSpeed: 0,
  altitude: 0, elevGain: 0, elevLoss: 0, isPaused: false,
};

export const useWorkout = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving]   = useState(false);
  const [metrics, setMetrics]     = useState<LiveMetrics>(EMPTY_METRICS);
  const [route, setRoute]         = useState<RoutePoint[]>([]);
  const [workoutType, setWorkoutType] = useState<WorkoutType>('running');
  const [pendingSession, setPendingSession] = useState<WorkoutSession | null>(null);

  const startTime     = useRef<Date | null>(null);
  const locationSub   = useRef<Location.LocationSubscription | null>(null);
  const hrInterval    = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const routeRef      = useRef<RoutePoint[]>([]);
  const metricsRef    = useRef<LiveMetrics>(EMPTY_METRICS);

  // Elevation smoothing
  const altEmaRef     = useRef<number | null>(null);
  const lastStableAlt = useRef<number | null>(null);

  // Auto-pause state
  const isPausedRef       = useRef(false);
  const movingTimeRef     = useRef(0);
  const lastMovingTick    = useRef<number | null>(null);

  const startWorkout = useCallback(async (type: WorkoutType) => {
    setWorkoutType(type);
    setRoute([]);
    setMetrics(EMPTY_METRICS);
    routeRef.current    = [];
    metricsRef.current  = EMPTY_METRICS;
    altEmaRef.current   = null;
    lastStableAlt.current = null;
    isPausedRef.current = false;
    movingTimeRef.current = 0;
    lastMovingTick.current = null;
    startTime.current   = new Date();
    setIsRunning(true);

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { setIsRunning(false); return; }

    const hasGPS = type === 'running' || type === 'cycling';

    if (hasGPS) {
      locationSub.current = await startLocationTracking((point) => {
        routeRef.current = [...routeRef.current, point];
        setRoute([...routeRef.current]);

        const speedMs  = Math.max(0, point.speed);
        const speedKmh = speedMs * 3.6;
        const dist     = calculateDistance(routeRef.current);
        const elapsed  = (Date.now() - startTime.current!.getTime()) / 1000;

        // Auto-pause / resume
        const wasMoving = !isPausedRef.current;
        if (wasMoving && speedMs < PAUSE_THRESHOLD_MS) {
          isPausedRef.current = true;
          lastMovingTick.current = null;
        } else if (!wasMoving && speedMs > RESUME_THRESHOLD_MS) {
          isPausedRef.current = false;
          lastMovingTick.current = Date.now();
        }
        if (!isPausedRef.current && lastMovingTick.current) {
          movingTimeRef.current += (Date.now() - lastMovingTick.current) / 1000;
        }
        lastMovingTick.current = isPausedRef.current ? null : Date.now();

        // Elevation (EMA + noise filter)
        if (altEmaRef.current === null) {
          altEmaRef.current   = point.altitude;
          lastStableAlt.current = point.altitude;
        } else {
          altEmaRef.current = altEmaRef.current * 0.7 + point.altitude * 0.3;
        }
        let elevGain = metricsRef.current.elevGain;
        let elevLoss = metricsRef.current.elevLoss;
        if (lastStableAlt.current !== null) {
          const diff = altEmaRef.current - lastStableAlt.current;
          if (diff > ALT_NOISE_FILTER)  { elevGain += diff; lastStableAlt.current = altEmaRef.current; }
          if (diff < -ALT_NOISE_FILTER) { elevLoss += Math.abs(diff); lastStableAlt.current = altEmaRef.current; }
        }

        const avgSpeedKmh = elapsed > 0 ? (dist / 1000) / (elapsed / 3600) : 0;
        const updated: LiveMetrics = {
          ...metricsRef.current,
          distance:    dist,
          speed:       speedKmh,
          avgSpeed:    avgSpeedKmh,
          maxSpeed:    Math.max(metricsRef.current.maxSpeed, speedKmh),
          pace:        speedMs > 0.5 ? 1000 / speedMs : 0,
          calories:    (dist / 1000) * 0.06 * 80,
          duration:    elapsed,
          movingTime:  movingTimeRef.current,
          altitude:    point.altitude,
          elevGain,
          elevLoss,
          isPaused:    isPausedRef.current,
        };
        metricsRef.current = updated;
        setMetrics(updated);
      });
    }

    hrInterval.current = setInterval(async () => {
      const hr    = await getLatestHeartRate();
      const maxHr = Math.max(metricsRef.current.maxHeartRate, hr);
      if (hr > 0) {
        metricsRef.current = {
          ...metricsRef.current,
          heartRate: hr,
          maxHeartRate: maxHr,
          hrZone: getHRZone(hr),
        };
        setMetrics(prev => ({ ...prev, heartRate: hr, maxHeartRate: maxHr, hrZone: getHRZone(hr) }));
      }
    }, 5000);

    timerInterval.current = setInterval(() => {
      if (!startTime.current) return;
      const elapsed = (Date.now() - startTime.current.getTime()) / 1000;
      if (!isPausedRef.current) {
        movingTimeRef.current += 1;
      }
      setMetrics(prev => ({ ...prev, duration: elapsed, movingTime: movingTimeRef.current, isPaused: isPausedRef.current }));
    }, 1000);
  }, []);

  const stopWorkout = useCallback(async () => {
    const endTime      = new Date();
    const finalMetrics = metricsRef.current;
    const finalRoute   = [...routeRef.current];
    const type         = workoutType;
    const start        = startTime.current!;

    setIsRunning(false);
    locationSub.current?.remove();
    if (hrInterval.current)    clearInterval(hrInterval.current);
    if (timerInterval.current) clearInterval(timerInterval.current);
    startTime.current = null;

    const session: WorkoutSession = {
      id: '', type, startTime: start, endTime,
      duration:    finalMetrics.duration,
      movingTime:  finalMetrics.movingTime,
      distance:    finalMetrics.distance,
      calories:    finalMetrics.calories,
      avgHeartRate: finalMetrics.heartRate,
      maxHeartRate: finalMetrics.maxHeartRate,
      maxSpeed:    finalMetrics.maxSpeed,
      elevGain:    finalMetrics.elevGain,
      elevLoss:    finalMetrics.elevLoss,
      route:       finalRoute,
    };
    // Show post-workout sheet for notes/feeling before saving
    setPendingSession(session);
  }, [workoutType]);

  const saveSession = useCallback(async (session: WorkoutSession) => {
    setPendingSession(null);
    setIsSaving(true);
    try {
      await saveWorkout(session);
    } catch (e) {
      console.warn('Workout save failed:', e);
    } finally {
      setIsSaving(false);
      setMetrics(EMPTY_METRICS);
    }
  }, []);

  const discardPending = useCallback(() => {
    setPendingSession(null);
    setMetrics(EMPTY_METRICS);
  }, []);

  useEffect(() => () => {
    locationSub.current?.remove();
    if (hrInterval.current)    clearInterval(hrInterval.current);
    if (timerInterval.current) clearInterval(timerInterval.current);
  }, []);

  return { isRunning, isSaving, metrics, route, workoutType, pendingSession, startWorkout, stopWorkout, saveSession, discardPending };
};
