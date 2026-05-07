import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ozodcynozlwcsjtruorx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96b2RjeW5vemx3Y3NqdHJ1b3J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMzI2OTcsImV4cCI6MjA5MzcwODY5N30.hQinkHHJ0FrMiPe1Xn4SAa8mbgO7TH7DbIwvw8xSEPo'
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const trainerId = '123e4567-e89b-12d3-a456-426614174000';
  const { data, error } = await supabase
    .from('trainer_clients')
    .select(`
      client:users!client_id(
        id, email, full_name,
        user_schedules (
          workout_templates ( name )
        )
      )
    `)
    .eq('trainer_id', trainerId)
    .eq('status', 'approved')
    
  console.log('Result:', JSON.stringify(data, null, 2))
  console.log('Error:', error)
}

test()
