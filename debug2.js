const { Client } = require('pg');

const connectionString = 'postgres://postgres:KSnhGjgZ0OkOiVD6@db.ozodcynozlwcsjtruorx.supabase.co:5432/postgres';

async function test() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const res = await client.query("SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users'");
    console.table(res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
test();
