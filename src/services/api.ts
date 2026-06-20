import { WorkoutSession } from '../types/workout';

const BASE_URL = 'https://api.staging.volke.cloud/v1/apps/60c4ad89-c7c5-49d2-a7e8-bd7405a1e8b0/proxy';

const request = async (path: string, options?: RequestInit) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
};

export const saveWorkout = async (workout: WorkoutSession): Promise<void> => {
  await request('/workouts', {
    method: 'POST',
    body: JSON.stringify(workout),
  });
};

export const fetchWorkouts = async (): Promise<WorkoutSession[]> => {
  const rows = await request('/workouts');
  return rows.map((r: any) => ({
    id: r.id,
    type: r.type,
    startTime: new Date(r.started_at),
    endTime: r.ended_at ? new Date(r.ended_at) : undefined,
    duration: r.duration,
    distance: r.distance,
    calories: r.calories,
    avgHeartRate: r.avg_hr,
    maxHeartRate: r.max_hr,
    route: r.route ?? [],
  }));
};

export const deleteWorkout = async (id: string): Promise<void> => {
  await request(`/workouts/${id}`, { method: 'DELETE' });
};
