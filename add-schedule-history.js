const { Client } = require('pg');

const connectionString = 'postgres://postgres:KSnhGjgZ0OkOiVD6@db.ozodcynozlwcsjtruorx.supabase.co:5432/postgres';

async function migrate() {
  const client = new Client({ connectionString });
  try {
    await client.connect();

    console.log('Creating schedule_history table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS schedule_history (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
        template_id UUID REFERENCES workout_templates(id) ON DELETE RESTRICT NOT NULL,
        assigned_by_trainer_id UUID REFERENCES users(id) ON DELETE SET NULL,
        day_of_week_mapping JSONB NOT NULL,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
        ended_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_schedule_history_user_id ON schedule_history(user_id);
      CREATE INDEX IF NOT EXISTS idx_schedule_history_open ON schedule_history(user_id, ended_at);
    `);

    console.log('Backfilling from current user_schedules (if missing open history)...');
    await client.query(`
      INSERT INTO schedule_history (user_id, template_id, day_of_week_mapping, started_at, ended_at)
      SELECT us.user_id, us.template_id, us.day_of_week_mapping, us.created_at, NULL
      FROM user_schedules us
      WHERE NOT EXISTS (
        SELECT 1
        FROM schedule_history sh
        WHERE sh.user_id = us.user_id
          AND sh.ended_at IS NULL
      );
    `);

    console.log('Done.');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await client.end();
  }
}

migrate();
