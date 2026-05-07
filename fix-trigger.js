const { Client } = require('pg');

const connectionString = 'postgres://postgres:KSnhGjgZ0OkOiVD6@db.ozodcynozlwcsjtruorx.supabase.co:5432/postgres';

async function updateTrigger() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    console.log('Fixing the trigger to include username...');
    await client.query(`
      CREATE OR REPLACE FUNCTION public.handle_new_user() 
      RETURNS trigger AS $$
      BEGIN
        INSERT INTO public.users (id, role, email, full_name, username)
        VALUES (
          new.id,
          COALESCE(new.raw_user_meta_data->>'role', 'athlete'),
          new.email,
          new.raw_user_meta_data->>'full_name',
          COALESCE(new.raw_user_meta_data->>'username', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
        );
        RETURN new;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);
    
    console.log('Trigger fixed successfully!');
  } catch (err) {
    console.error('Error updating trigger:', err);
  } finally {
    await client.end();
  }
}

updateTrigger();
