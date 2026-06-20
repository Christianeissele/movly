import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  max: 5,
});

export const initDB = async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS workouts (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     TEXT NOT NULL DEFAULT 'default',
      type        TEXT NOT NULL,
      started_at  TIMESTAMPTZ NOT NULL,
      ended_at    TIMESTAMPTZ,
      duration    INTEGER NOT NULL DEFAULT 0,
      distance    REAL NOT NULL DEFAULT 0,
      calories    REAL NOT NULL DEFAULT 0,
      avg_hr      INTEGER NOT NULL DEFAULT 0,
      max_hr      INTEGER NOT NULL DEFAULT 0,
      route       JSONB NOT NULL DEFAULT '[]',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log('DB ready');
};

export default sql;
