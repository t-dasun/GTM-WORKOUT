const { Client } = require('pg')

const connectionString = process.env.SUPABASE_DB_URL || 'postgres://postgres:KSnhGjgZ0OkOiVD6@db.ozodcynozlwcsjtruorx.supabase.co:5432/postgres'

async function main() {
  console.log('Creating user_schedule_customizations table...')
  const client = new Client({ connectionString })

  const sql = `
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS public.user_schedule_customizations (
      id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
      user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
      user_schedule_id UUID REFERENCES public.user_schedules(id) ON DELETE CASCADE,
      day_sequence_number INTEGER NOT NULL,
      exercise_id UUID REFERENCES public.exercises(id) ON DELETE RESTRICT,
      is_added BOOLEAN DEFAULT false,
      custom_tracking_type TEXT CHECK (custom_tracking_type IS NULL OR custom_tracking_type IN ('weight', 'level')),
      initial_weight NUMERIC,
      order_in_day INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
    );

    CREATE INDEX IF NOT EXISTS idx_user_schedule_customizations_user_id ON public.user_schedule_customizations(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_schedule_customizations_schedule_id ON public.user_schedule_customizations(user_schedule_id);
    CREATE INDEX IF NOT EXISTS idx_user_schedule_customizations_day ON public.user_schedule_customizations(user_schedule_id, day_sequence_number);
  `

  try {
    await client.connect()
    await client.query(sql)
    console.log('user_schedule_customizations migration complete.')
  } finally {
    await client.end()
  }

  console.log('Done.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

