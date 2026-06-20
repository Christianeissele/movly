import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { query, initDB } from './db.js';

const app = new Hono();
app.use('*', cors());

app.get('/', (c) => c.json({ status: 'ok', app: 'movly-api' }));

app.get('/workouts', async (c) => {
  try {
    const rows = await query('/workouts?order=started_at.desc&limit=100');
    return c.json(rows);
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/workouts', async (c) => {
  try {
    const body = await c.req.json();
    const row = await query('/workouts', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        type:       body.type,
        started_at: body.startTime,
        ended_at:   body.endTime ?? null,
        duration:   body.duration   ?? 0,
        distance:   body.distance   ?? 0,
        calories:   body.calories   ?? 0,
        avg_hr:     body.avgHeartRate ?? 0,
        max_hr:     body.maxHeartRate ?? 0,
        route:      body.route      ?? [],
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
  console.log(`Movly API running on port ${info.port}`);
  try {
    await initDB();
  } catch (e) {
    console.error('Supabase init error:', e.message);
  }
});
