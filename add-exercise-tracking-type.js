const { Client } = require('pg');

const connectionString = 'postgres://postgres:KSnhGjgZ0OkOiVD6@db.ozodcynozlwcsjtruorx.supabase.co:5432/postgres';

async function migrate() {
  const client = new Client({ connectionString });
  try {
    await client.connect();

    console.log('Adding tracking_type to exercises...');
    await client.query(`
      ALTER TABLE public.exercises
      ADD COLUMN IF NOT EXISTS tracking_type TEXT DEFAULT 'weight';

      UPDATE public.exercises
      SET tracking_type = 'weight'
      WHERE tracking_type IS NULL;

      ALTER TABLE public.exercises
      DROP CONSTRAINT IF EXISTS exercises_tracking_type_check;

      ALTER TABLE public.exercises
      ADD CONSTRAINT exercises_tracking_type_check
      CHECK (tracking_type IN ('weight', 'level'));
    `);

    console.log('Done.');
  } catch (err) {
    console.error('Migration error:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

migrate();
