import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ozodcynozlwcsjtruorx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96b2RjeW5vemx3Y3NqdHJ1b3J4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMzI2OTcsImV4cCI6MjA5MzcwODY5N30.hQinkHHJ0FrMiPe1Xn4SAa8mbgO7TH7DbIwvw8xSEPo'
const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  const { data, error } = await supabase
    .from('trainer_clients')
    .select(`
      client_id,
      client:users!client_id(
        id, email, full_name
      )
    `)
    
  console.log(JSON.stringify(data, null, 2), error)
}

test()
