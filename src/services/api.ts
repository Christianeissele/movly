import { WorkoutSession } from '../types/workout';

const BASE = 'https://api.staging.volke.cloud/v1/apps/60c4ad89-c7c5-49d2-a7e8-bd7405a1e8b0/proxy';

const req = async (path: string, options?: RequestInit) => {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
};

export const saveWorkout = async (w: WorkoutSession): Promise<void> => {
  await req('/workouts', {
    method: 'POST',
    body: JSON.stringify({
      type:         w.type,
      startTime:    w.startTime,
      endTime:      w.endTime,
      duration:     Math.round(w.duration),
      movingTime:   Math.round(w.movingTime ?? w.duration),
      distance:     w.distance,
      calories:     Math.round(w.calories),
      avgHeartRate: Math.round(w.avgHeartRate ?? 0),
      maxHeartRate: Math.round(w.maxHeartRate ?? 0),
      maxSpeed:     w.maxSpeed ?? 0,
      elevGain:     Math.round(w.elevGain ?? 0),
      elevLoss:     Math.round(w.elevLoss ?? 0),
      notes:        w.notes,
      feeling:      w.feeling,
      route:        w.route,
    }),
  });
};

export const fetchWorkouts = async (): Promise<WorkoutSession[]> => {
  const rows = await req('/workouts');
  return rows.map((r: any) => ({
    id:           r.id,
    type:         r.type,
    startTime:    new Date(r.started_at),
    endTime:      r.ended_at ? new Date(r.ended_at) : undefined,
    duration:     r.duration,
    movingTime:   r.moving_time ?? r.duration,
    distance:     r.distance,
    calories:     r.calories,
    avgHeartRate: r.avg_hr,
    maxHeartRate: r.max_hr,
    maxSpeed:     r.max_speed ?? 0,
    elevGain:     r.elev_gain ?? 0,
    elevLoss:     r.elev_loss ?? 0,
    notes:        r.notes,
    feeling:      r.feeling,
    route:        r.route ?? [],
  }));
};

export const deleteWorkout = async (id: string): Promise<void> => {
  await req(`/workouts/${id}`, { method: 'DELETE' });
};
