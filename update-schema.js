const { Client } = require('pg');

const connectionString = 'postgres://postgres:KSnhGjgZ0OkOiVD6@db.ozodcynozlwcsjtruorx.supabase.co:5432/postgres';

async function updateSchema() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    console.log('Updating template_exercises schema...');
    await client.query(`
      ALTER TABLE template_exercises DROP COLUMN IF EXISTS target_sets;
      ALTER TABLE template_exercises DROP COLUMN IF EXISTS target_reps;
      ALTER TABLE template_exercises DROP COLUMN IF EXISTS target_weight_or_level;
      ALTER TABLE template_exercises ADD COLUMN IF NOT EXISTS sets_data JSONB DEFAULT '[]'::jsonb;
    `);
    
    console.log('Schema updated successfully!');
  } catch (err) {
    console.error('Error updating schema:', err);
  } finally {
    await client.end();
  }
}

updateSchema();
