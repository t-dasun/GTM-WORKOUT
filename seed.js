const { Client } = require('pg');

const connectionString = 'postgres://postgres:KSnhGjgZ0OkOiVD6@db.ozodcynozlwcsjtruorx.supabase.co:5432/postgres';

async function seed() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    
    console.log('Seeding muscle groups...');
    await client.query(`
      INSERT INTO muscle_groups (name) VALUES 
      ('Chest'), ('Back'), ('Legs'), ('Shoulders'), ('Arms'), ('Core')
      ON CONFLICT (name) DO NOTHING;
    `);
    
    const allMgRes = await client.query('SELECT id, name FROM muscle_groups');
    const mgMap = {};
    allMgRes.rows.forEach(r => mgMap[r.name] = r.id);

    const existCount = await client.query('SELECT COUNT(*) FROM exercises WHERE is_global = true');
    
    if (parseInt(existCount.rows[0].count) === 0) {
      console.log('Seeding exercises...');
      const exercises = [
        { name: 'Bench Press', mg: 'Chest' },
        { name: 'Push Up', mg: 'Chest' },
        { name: 'Pull Up', mg: 'Back' },
        { name: 'Deadlift', mg: 'Back' },
        { name: 'Squat', mg: 'Legs' },
        { name: 'Leg Press', mg: 'Legs' },
        { name: 'Overhead Press', mg: 'Shoulders' },
        { name: 'Bicep Curl', mg: 'Arms' },
        { name: 'Tricep Extension', mg: 'Arms' },
        { name: 'Plank', mg: 'Core' }
      ];

      for (const ex of exercises) {
        if (mgMap[ex.mg]) {
          await client.query(`
            INSERT INTO exercises (name, muscle_group_id, is_global) 
            VALUES ($1, $2, true)
          `, [ex.name, mgMap[ex.mg]]);
        }
      }
      console.log('Exercises seeded.');
    } else {
      console.log('Exercises already seeded. Skipping.');
    }
    
    console.log('Seeding completed successfully!');
  } catch (err) {
    console.error('Error seeding:', err);
  } finally {
    await client.end();
  }
}

seed();
