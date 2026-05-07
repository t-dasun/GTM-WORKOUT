const { Client } = require('pg');

const connectionString = 'postgres://postgres:KSnhGjgZ0OkOiVD6@db.ozodcynozlwcsjtruorx.supabase.co:5432/postgres';

async function migrate() {
  const client = new Client({ connectionString });
  try {
    await client.connect();

    console.log('Creating exercise_muscle_groups junction table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS exercise_muscle_groups (
        exercise_id UUID REFERENCES exercises(id) ON DELETE CASCADE,
        muscle_group_id UUID REFERENCES muscle_groups(id) ON DELETE CASCADE,
        PRIMARY KEY (exercise_id, muscle_group_id)
      );
    `);

    console.log('Migrating existing single muscle_group_id data to junction table...');
    await client.query(`
      INSERT INTO exercise_muscle_groups (exercise_id, muscle_group_id)
      SELECT id, muscle_group_id
      FROM exercises
      WHERE muscle_group_id IS NOT NULL
      ON CONFLICT DO NOTHING;
    `);

    console.log('Done! Junction table ready.');
  } catch (err) {
    console.error('Migration error:', err);
  } finally {
    await client.end();
  }
}

migrate();
