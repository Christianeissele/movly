import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import sql, { initDB } from './db.js';

const app = new Hono();

app.use('*', cors());

// Health check
app.get('/', (c) => c.json({ status: 'ok', app: 'movly-api' }));

// GET /workouts — letzte 50 Trainings
app.get('/workouts', async (c) => {
  const rows = await sql`
    SELECT * FROM workouts
    ORDER BY started_at DESC
    LIMIT 50
  `;
  return c.json(rows);
});

// POST /workouts — Training speichern
app.post('/workouts', async (c) => {
  const body = await c.req.json();
  const [row] = await sql`
    INSERT INTO workouts
      (type, started_at, ended_at, duration, distance, calories, avg_hr, max_hr, route)
    VALUES
      (
        ${body.type},
        ${body.startTime},
        ${body.endTime ?? null},
        ${body.duration ?? 0},
        ${body.distance ?? 0},
        ${body.calories ?? 0},
        ${body.avgHeartRate ?? 0},
        ${body.maxHeartRate ?? 0},
        ${JSON.stringify(body.route ?? [])}
      )
    RETURNING *
  `;
  return c.json(row, 201);
});

// DELETE /workouts/:id
app.delete('/workouts/:id', async (c) => {
  await sql`DELETE FROM workouts WHERE id = ${c.req.param('id')}`;
  return c.json({ ok: true });
});

await initDB();
serve({ fetch: app.fetch, port: process.env.PORT ?? 3000 }, (info) => {
  console.log(`Movly API running on port ${info.port}`);
});
