const { Client } = require('pg');

const connectionString = 'postgres://postgres:KSnhGjgZ0OkOiVD6@db.ozodcynozlwcsjtruorx.supabase.co:5432/postgres';

async function test() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const res = await client.query("SELECT * FROM workout_templates");
    console.table(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
test();
