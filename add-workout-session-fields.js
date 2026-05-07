const { Client } = require('pg');

const connectionString = 'postgres://postgres:KSnhGjgZ0OkOiVD6@db.ozodcynozlwcsjtruorx.supabase.co:5432/postgres';

async function migrate() {
  const client = new Client({ connectionString });
  try {
    await client.connect();

    console.log('Adding workout session metadata columns...');
    await client.query(`
      ALTER TABLE public.workout_logs
        ADD COLUMN IF NOT EXISTS session_id UUID,
        ADD COLUMN IF NOT EXISTS session_day_number INTEGER;

      CREATE INDEX IF NOT EXISTS idx_workout_logs_user_session_id
        ON public.workout_logs(user_id, session_id);

      CREATE INDEX IF NOT EXISTS idx_workout_logs_user_session_day_number
        ON public.workout_logs(user_id, session_day_number, timestamp);
    `);

    console.log('Backfilling session_id for old rows grouped by user/date...');
    await client.query(`
      WITH grouped AS (
        SELECT
          user_id,
          DATE(timezone('utc', timestamp)) AS session_date,
          uuid_generate_v4() AS generated_session_id
        FROM public.workout_logs
        WHERE session_id IS NULL
        GROUP BY user_id, DATE(timezone('utc', timestamp))
      )
      UPDATE public.workout_logs wl
      SET session_id = g.generated_session_id
      FROM grouped g
      WHERE wl.session_id IS NULL
        AND wl.user_id = g.user_id
        AND DATE(timezone('utc', wl.timestamp)) = g.session_date;
    `);

    console.log('Workout log session migration complete.');
  } catch (err) {
    console.error('Migration error:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

migrate();
