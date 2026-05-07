const { Client } = require('pg');

const connectionString = 'postgres://postgres:KSnhGjgZ0OkOiVD6@db.ozodcynozlwcsjtruorx.supabase.co:5432/postgres';

const planData = [
  {
    day: 1,
    exercises: [
      { name: "Pull up", reps: [12, 10, 8, 6], mg: "Back" },
      { name: "Pull over", reps: [12, 10, 8, 6], mg: "Chest" },
      { name: "Shoulder press", reps: [12, 12, 10, 10], mg: "Shoulders" },
      { name: "DB front raise", reps: [12, 12, 10, 10], mg: "Shoulders" },
      { name: "DB arnold press", reps: [12, 12, 10, 10], mg: "Shoulders" },
      { name: "DB lateral raise", reps: [12, 12, 10, 10], mg: "Shoulders" },
      { name: "Bent over flys", reps: [10, 10, 10], mg: "Shoulders" },
      { name: "Upright row", reps: [10, 10, 10], mg: "Shoulders" },
      { name: "DB shrug", reps: [10, 10, 10], mg: "Shoulders" },
      { name: "Cable face pull", reps: [10, 10, 10], mg: "Shoulders" },
      { name: "Wrist curl", reps: [20, 20, 20, 20], mg: "Arms" }
    ]
  },
  {
    day: 2,
    exercises: [
      { name: "Push up", reps: [20, 20, 20, 20], mg: "Chest" },
      { name: "Pull up", reps: [12, 12, 10, 10], mg: "Back" },
      { name: "Lat pull down", reps: [12, 10, 8, 6], mg: "Back" },
      { name: "T Bar row", reps: [12, 12, 10, 10], mg: "Back" },
      { name: "Seated cable row", reps: [12, 12, 10, 10], mg: "Back" },
      { name: "DB one arm row", reps: [12, 12, 10, 10], mg: "Back" },
      { name: "Stiff deadlift", reps: [12, 12, 10, 10], mg: "Legs" },
      { name: "Triceps over head extension", reps: [12, 12, 10, 10], mg: "Arms" },
      { name: "Triceps push down", reps: [12, 12, 10, 10], mg: "Arms" },
      { "name": "Lying triceps extension", "reps": [12, 12, 10, 10], mg: "Arms" },
      { name: "Tricep kick back", reps: [12, 12, 10, 10], mg: "Arms" }
    ]
  },
  {
    day: 3,
    exercises: [
      { name: "Push up", reps: [24, 24, 24, 24], mg: "Chest" },
      { name: "Pull over", reps: [12, 12, 10, 10], mg: "Chest" },
      { name: "Bench Press", reps: [10, 10, 10], mg: "Chest" },
      { name: "Incline press", reps: [10, 10, 10], mg: "Chest" },
      { name: "Fly", reps: [12, 12, 10, 10], mg: "Chest" },
      { name: "Decline press", reps: [12, 12, 10, 10], mg: "Chest" },
      { name: "BB curl", reps: [10, 10, 10], mg: "Arms" },
      { name: "DB curl", reps: [10, 10, 10], mg: "Arms" },
      { name: "Hammer curl", reps: [12, 12, 10, 10], mg: "Arms" },
      { name: "Preacher curl", reps: [12, 12, 10, 10], mg: "Arms" },
      { name: "Wrist curl", reps: [20, 20, 20, 20], mg: "Arms" }
    ]
  },
  {
    day: 4,
    exercises: [
      { name: "Air squat", reps: [20, 20, 20, 20], mg: "Legs" },
      { name: "Squat", reps: [12, 12, 10, 10], mg: "Legs" },
      { name: "DB goblet squat", reps: [10, 10, 10], mg: "Legs" },
      { name: "Leg Press", reps: [10, 10, 10], mg: "Legs" },
      { name: "Hack Squat", reps: [10, 10, 10], mg: "Legs" },
      { name: "Leg extension", reps: [10, 10, 10], mg: "Legs" },
      { name: "Good morning", reps: [20, 20, 20, 20], mg: "Legs" },
      { name: "RDL", reps: [10, 10, 10], mg: "Legs" },
      { name: "Leg curl", reps: [12, 12, 10, 10], mg: "Legs" },
      { name: "Calf raise", reps: [20, 20, 20, 20], mg: "Legs" }
    ]
  }
]

async function seed() {
  const client = new Client({ connectionString });
  try {
    await client.connect();

    // 1. Fetch muscle groups
    const mgRes = await client.query('SELECT id, name FROM muscle_groups');
    const mgMap = {};
    mgRes.rows.forEach(r => mgMap[r.name] = r.id);

    // 2. Ensure exercises exist
    console.log('Ensuring all exercises exist...');
    const allExNames = new Set();
    planData.forEach(d => d.exercises.forEach(ex => allExNames.add(ex.name)));
    
    for (let exName of Array.from(allExNames)) {
      // Find its mg from planData
      const found = planData.flatMap(d => d.exercises).find(e => e.name === exName);
      
      const mgId = mgMap[found.mg] || mgMap['Chest']; // fallback
      await client.query(`
        INSERT INTO exercises (name, muscle_group_id, is_global) 
        VALUES ($1, $2, true) 
        ON CONFLICT DO NOTHING
      `, [exName, mgId]);
    }

    const exRes = await client.query('SELECT id, name FROM exercises');
    const exMap = {};
    exRes.rows.forEach(r => exMap[r.name] = r.id);

    // 3. Create the Template
    // We'll set trainer_id to null so it's a global template available to anyone.
    console.log('Creating Intermediate Plan template...');
    const tRes = await client.query(`
      INSERT INTO workout_templates (name, level)
      VALUES ($1, $2) RETURNING id
    `, ['Intermediate Plan', 'Intermediate']);
    const templateId = tRes.rows[0].id;

    // 4. Create Days and Exercises
    for (let day of planData) {
      const dRes = await client.query(`
        INSERT INTO template_days (template_id, day_sequence_number)
        VALUES ($1, $2) RETURNING id
      `, [templateId, day.day]);
      const dayId = dRes.rows[0].id;

      for (let i = 0; i < day.exercises.length; i++) {
        const ex = day.exercises[i];
        const setsData = ex.reps.map((rep, idx) => ({
          setNumber: idx + 1,
          reps: rep,
          weight: 0 // Keep weights empty as requested
        }));

        await client.query(`
          INSERT INTO template_exercises (template_day_id, exercise_id, order_in_day, sets_data)
          VALUES ($1, $2, $3, $4)
        `, [dayId, exMap[ex.name], i, JSON.stringify(setsData)]);
      }
    }

    console.log('Successfully seeded the Intermediate Plan!');
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

seed();
