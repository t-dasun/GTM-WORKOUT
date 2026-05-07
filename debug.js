const { Client } = require('pg');

const connectionString = 'postgres://postgres:KSnhGjgZ0OkOiVD6@db.ozodcynozlwcsjtruorx.supabase.co:5432/postgres';

async function test() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    const res = await client.query('SELECT column_name FROM information_schema.columns WHERE table_name = $1', ['users']);
    console.log("Columns in users table:", res.rows.map(r => r.column_name));
    
    // Also test the trigger manually
    const triggerRes = await client.query(`
      SELECT routine_definition 
      FROM information_schema.routines 
      WHERE routine_name = 'handle_new_user'
    `);
    console.log("Trigger body:", triggerRes.rows[0]?.routine_definition);
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}
test();
