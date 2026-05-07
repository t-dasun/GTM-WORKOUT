-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE users (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  role TEXT CHECK (role IN ('athlete', 'trainer', 'admin')) NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT,
  age INTEGER,
  gender TEXT,
  weight NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Trainer-Client Relationships
CREATE TABLE trainer_clients (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  trainer_id UUID REFERENCES users(id) ON DELETE CASCADE,
  client_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('pending', 'approved')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(trainer_id, client_id)
);

-- 3. Exercise Dictionary
CREATE TABLE muscle_groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE exercises (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  muscle_group_id UUID REFERENCES muscle_groups(id) ON DELETE RESTRICT,
  tracking_type TEXT DEFAULT 'weight' CHECK (tracking_type IN ('weight', 'level')),
  is_global BOOLEAN DEFAULT false,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 4. Workout Plans
CREATE TABLE workout_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  trainer_id UUID REFERENCES users(id) ON DELETE CASCADE, -- Nullable? The PRD says "nullable for independent users". So I should remove NOT NULL if it's there. Actually CASCADE is fine if trainer_id is null it doesn't cascade.
  name TEXT NOT NULL,
  level TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE template_days (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  template_id UUID REFERENCES workout_templates(id) ON DELETE CASCADE,
  day_sequence_number INTEGER NOT NULL,
  UNIQUE(template_id, day_sequence_number)
);

CREATE TABLE template_exercises (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  template_day_id UUID REFERENCES template_days(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id) ON DELETE RESTRICT,
  target_sets INTEGER NOT NULL,
  target_reps INTEGER NOT NULL,
  target_weight_or_level TEXT,
  order_in_day INTEGER NOT NULL
);

-- 5. Execution Tracking
CREATE TABLE user_schedules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES workout_templates(id) ON DELETE RESTRICT,
  day_of_week_mapping JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 6. User Schedule Customizations (per-user overrides/additions)
CREATE TABLE user_schedule_customizations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_schedule_id UUID REFERENCES user_schedules(id) ON DELETE CASCADE,
  day_sequence_number INTEGER NOT NULL,
  exercise_id UUID REFERENCES exercises(id) ON DELETE RESTRICT,
  is_added BOOLEAN DEFAULT false, -- true if user added this exercise (not from template)
  custom_tracking_type TEXT CHECK (custom_tracking_type IS NULL OR custom_tracking_type IN ('weight', 'level')), -- NULL means use exercise default
  initial_weight NUMERIC, -- user can set custom starting weight
  order_in_day INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE workout_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id) ON DELETE RESTRICT,
  session_id UUID,
  session_day_number INTEGER,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  sets_completed INTEGER,
  reps_completed INTEGER,
  weight_used NUMERIC
);

-- Trigger Function to handle new user signup and insert into public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, role, email)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    new.raw_user_meta_data->>'role',
    new.email
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
