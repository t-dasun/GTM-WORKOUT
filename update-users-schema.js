const { Client } = require('pg');

const connectionString = 'postgres://postgres:KSnhGjgZ0OkOiVD6@db.ozodcynozlwcsjtruorx.supabase.co:5432/postgres';

async function updateSchema() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    console.log('Adding email and full_name to users table...');
    await client.query(`
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
      ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name TEXT;

      UPDATE public.users pu
      SET email = au.email,
          full_name = au.raw_user_meta_data->>'full_name'
      FROM auth.users au
      WHERE pu.id = au.id;

      CREATE OR REPLACE FUNCTION public.handle_new_user() 
      RETURNS trigger AS $$
      BEGIN
        INSERT INTO public.users (id, role, email, full_name)
        VALUES (
          new.id,
          COALESCE(new.raw_user_meta_data->>'role', 'athlete'),
          new.email,
          new.raw_user_meta_data->>'full_name'
        );
        RETURN new;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);
    
    console.log('Schema updated successfully!');
  } catch (err) {
    console.error('Error updating schema:', err);
  } finally {
    await client.end();
  }
}

updateSchema();
