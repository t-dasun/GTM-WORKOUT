const { Client } = require('pg');

const connectionString = 'postgres://postgres:KSnhGjgZ0OkOiVD6@db.ozodcynozlwcsjtruorx.supabase.co:5432/postgres';

async function reloadSchema() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Reloading PostgREST schema cache...');
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log('Schema reloaded!');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

reloadSchema();
