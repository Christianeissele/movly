import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { query, initDB } from './db.js';

const app = new Hono();
app.use('*', cors());

app.get('/', (c) => c.json({ status: 'ok', app: 'movly-api' }));

app.get('/workouts', async (c) => {
  try {
    const rows = await query('/workouts?order=started_at.desc&limit=200');
    return c.json(rows);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/workouts', async (c) => {
  try {
    const b = await c.req.json();
    const row = await query('/workouts', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        type:        b.type,
        started_at:  b.startTime,
        ended_at:    b.endTime ?? null,
        duration:    b.duration     ?? 0,
        moving_time: b.movingTime   ?? b.duration ?? 0,
        distance:    b.distance     ?? 0,
        calories:    b.calories     ?? 0,
        avg_hr:      b.avgHeartRate ?? 0,
        max_hr:      b.maxHeartRate ?? 0,
        max_speed:   b.maxSpeed     ?? 0,
        elev_gain:   b.elevGain     ?? 0,
        elev_loss:   b.elevLoss     ?? 0,
        notes:       b.notes        ?? null,
        feeling:     b.feeling      ?? null,
        route:       b.route        ?? [],
      }),
    });
    return c.json(Array.isArray(row) ? row[0] : row, 201);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

app.delete('/workouts/:id', async (c) => {
  try {
    await query(`/workouts?id=eq.${c.req.param('id')}`, { method: 'DELETE' });
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

serve({ fetch: app.fetch, port: process.env.PORT ?? 3000 }, async (info) => {
  console.log(`Movly API on port ${info.port}`);
  try { await initDB(); } catch (e) { console.error('Supabase init:', e.message); }
});
