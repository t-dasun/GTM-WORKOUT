import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ozodcynozlwcsjtruorx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96b2RjeW5vemx3Y3NqdHJ1b3J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMzI2OTcsImV4cCI6MjA5MzcwODY5N30.hQinkHHJ0FrMiPe1Xn4SAa8mbgO7TH7DbIwvw8xSEPo'
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const trainerId = '123e4567-e89b-12d3-a456-426614174000'; // arbitrary uuid
  const { data, error } = await supabase
    .from('workout_templates')
    .select('*')
    .or(`trainer_id.eq.${trainerId},trainer_id.is.null`)
    
  console.log(data, error)
}

test()
