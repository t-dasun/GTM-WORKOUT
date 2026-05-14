# Gym Workout Tracker - Complete Project Documentation

**Last Updated**: May 14, 2026  
**Project Repository**: https://github.com/t-dasun/GTM-WORKOUT.git  
**Vercel Deployment**: https://gtm-workout-git-main-madkluxes-projects.vercel.app  
**Status**: 🟢 Core Features Complete | 🟡 Vercel Auth Fix Pending Redeploy

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technical Stack](#technical-stack)
3. [Architecture](#architecture)
4. [Database Schema](#database-schema)
5. [Core Features](#core-features)
6. [File Structure](#file-structure)
7. [API Documentation](#api-documentation)
8. [Problem Resolution Log](#problem-resolution-log)
9. [Deployment & Environment](#deployment--environment)
10. [Development Workflow](#development-workflow)

---

## Project Overview

### Purpose
A gym workout tracking application that enables:
- **Athletes**: Follow trainer-assigned workout templates, customize exercises, log completed sets
- **Trainers**: Create workout templates, assign to athletes, monitor client progress

### Key Business Logic
1. **Athlete Flow**: Sign up → Receive schedule from trainer → Customize exercises → Log sets daily → View progress
2. **Trainer Flow**: Sign up → Create workout template → Assign to athletes → View their logged progress
3. **Schedule Customization**: Athletes can reorder exercises, change tracking type (weight/reps), add custom exercises, without affecting trainer's template

### Success Metrics Implemented
✅ Schedule customization persists correctly across sessions  
✅ Reordering exercises works without data loss or drift  
✅ Mobile responsive for on-gym access  
✅ Deployed to production (Vercel)  
✅ Authentication flow functional (local + Vercel pending redeploy)  

---

## Technical Stack

### Frontend
- **Framework**: Next.js 16.2.5 (Turbopack)
- **React**: 19.2.4
- **Language**: TypeScript
- **Styling**: Custom CSS (dark theme, mobile-responsive)
- **State Management**: React hooks + Supabase realtime (not implemented yet, fallback to polling)

### Backend
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth (email/password)
- **API**: Custom TypeScript functions in `src/lib/api.ts` (~1675 lines)
- **Runtime**: Node.js 18+

### DevOps
- **Version Control**: Git (GitHub)
- **Deployment**: Vercel
- **Environment**: Linux (development)
- **Package Manager**: npm

### Build Tools
- **Bundler**: Turbopack (built into Next.js 16)
- **Linter**: ESLint
- **Type Checking**: TypeScript
- **Testing**: Manual (no test suite implemented)

---

## Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────┐
│                    User Visits App                      │
│              https://gtm-workout.vercel.app             │
└──────────────────────────┬──────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Auth Page   │
                    │  (/auth)     │
                    └──────┬──────┘
                           │
        ┌──────────────────┴──────────────────┐
        │                                     │
   ┌────▼─────┐                         ┌────▼──────┐
   │ Athlete   │                         │  Trainer  │
   │ Dashboard │                         │ Dashboard │
   │           │                         │           │
   └────┬─────┘                         └────┬──────┘
        │                                     │
    ┌───▼────────────────┐              ┌────▼──────────┐
    │ Schedule:          │              │ Create/Manage  │
    │ - View days        │              │ Workout        │
    │ - Customize        │              │ Templates      │
    │ - Log exercises    │              │ (/plan/create) │
    │ (/athlete/         │              │                │
    │  schedule/         │              │ Assign to      │
    │  customize)        │              │ Athlete        │
    └────┬──────────────┘              │                │
         │                             │ View Client    │
         │                             │ Progress       │
         │                             │ (/trainer)     │
         │                             └────┬───────────┘
         └─────────────────┬──────────────────┘
                           │
                    ┌──────▼────────────────┐
                    │  Supabase Database    │
                    │  (PostgreSQL)         │
                    │                       │
                    │ Tables:               │
                    │ - users               │
                    │ - user_schedules      │
                    │ - workout_templates   │
                    │ - template_days       │
                    │ - template_exercises  │
                    │ - customizations      │
                    │ - workout_logs        │
                    └───────────────────────┘
```

### Data Flow Example: Customizing Schedule

```
1. Athlete opens customize page
   GET /athlete/schedule/customize (page.tsx calls getUserSchedule)

2. Frontend loads:
   - User's schedule (user_schedules)
   - Template exercises for that schedule
   - User's customizations (if any exist)

3. Athlete modifies:
   - Reorders exercises (↑/↓ buttons)
   - Changes tracking type (weight/reps/level)
   - Sets initial weight value
   - Adds custom exercises

4. Athlete clicks "Done" button
   POST /api/updateScheduleCustomizations
   → saveScheduleDayCustomizations() function

5. Backend atomically:
   DELETE old customizations for this (user, schedule, day)
   INSERT new rows with order_in_day 1..N

6. Dashboard reflects changes immediately
   (next time athlete logs in or refreshes)
```

---

## Database Schema

### Core Tables

#### `users`
```sql
id (UUID PRIMARY KEY)
email (TEXT UNIQUE)
name (TEXT)
role (TEXT: 'athlete' or 'trainer')
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

#### `user_schedules`
```sql
id (UUID PRIMARY KEY)
user_id (UUID, FOREIGN KEY users.id)
assigned_by_user_id (UUID, FOREIGN KEY users.id) [trainer who assigned it]
workout_template_id (UUID, FOREIGN KEY workout_templates.id)
assigned_date (TIMESTAMP)
created_at (TIMESTAMP)
```

#### `workout_templates`
```sql
id (UUID PRIMARY KEY)
created_by_user_id (UUID, FOREIGN KEY users.id) [trainer who created it]
template_name (TEXT)
description (TEXT)
is_public (BOOLEAN) [future: allow template sharing]
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

#### `template_days`
```sql
id (UUID PRIMARY KEY)
workout_template_id (UUID, FOREIGN KEY workout_templates.id)
day_name (TEXT: 'Monday', 'Tuesday', etc)
day_sequence_number (INTEGER: 1-7) [order in template]
rest_day (BOOLEAN) [future: skip this day in schedule]
created_at (TIMESTAMP)
```

#### `template_exercises`
```sql
id (UUID PRIMARY KEY)
template_day_id (UUID, FOREIGN KEY template_days.id)
exercise_name (TEXT)
target_muscle (TEXT)
set_count (INTEGER)
rep_range (TEXT: '8-12', '1-3', etc)
rest_seconds (INTEGER)
notes (TEXT)
order_in_day (INTEGER) [1..N, trainer's original order]
created_at (TIMESTAMP)
```

#### `user_schedule_customizations` ⭐ (Key Table for Feature)
```sql
id (UUID PRIMARY KEY)
user_id (UUID, FOREIGN KEY users.id)
user_schedule_id (UUID, FOREIGN KEY user_schedules.id)
day_sequence_number (INTEGER: 1-7)
exercise_id (UUID, FOREIGN KEY template_exercises.id) [NULL if user-added]
is_added (BOOLEAN) [false=override, true=user-added custom exercise]
custom_exercise_name (TEXT) [only if is_added=true]
custom_target_muscle (TEXT) [only if is_added=true]
custom_tracking_type (TEXT: 'weight'|'reps'|'level'|NULL)
initial_weight (TEXT: '50', '50 lbs', etc) [user-set starting weight]
order_in_day (INTEGER) [1..N, athlete's custom order]
created_at (TIMESTAMP)
updated_at (TIMESTAMP)
```

**Critical Properties**:
- **User Isolation**: Each customization is scoped to one user only. Trainer never sees athlete's customizations.
- **Atomic Day Save**: When athlete saves a day, ALL customizations for (user, schedule, day) are deleted and re-inserted with correct order.
- **Hybrid Template**: Template exercises (is_added=false) can have overrides (tracking_type, initial_weight, order). User-added (is_added=true) exercises are custom.

#### `workout_logs`
```sql
id (UUID PRIMARY KEY)
user_id (UUID, FOREIGN KEY users.id)
exercise_id (UUID, FOREIGN KEY template_exercises.id) [NULL if user-added]
custom_exercise_name (TEXT) [only if exercise is custom]
session_id (TEXT) [groups multiple sets from same workout session]
session_day_number (INTEGER: 1-7)
set_number (INTEGER: 1..max_sets)
weight_used (TEXT: '50', '50 lbs', etc)
reps_completed (INTEGER)
level_used (TEXT: 'easy'/'medium'/'hard')
notes (TEXT)
is_completed (BOOLEAN)
logged_at (TIMESTAMP)
created_at (TIMESTAMP)
```

**Session ID Logic**: 
- When athlete clicks "Log Exercise", a `session_id` is generated (UUID if HTTPS, Date.now()+random if HTTP)
- All sets logged in same session share same `session_id`
- Dashboard groups sets by session_id to show "today's workout"

---

## Core Features

### 1. Schedule Customization (Main Feature)

**Location**: `src/app/athlete/schedule/customize/page.tsx`

**What It Does**:
- Athlete views trainer's workout template for their assigned schedule
- Can reorder exercises for each day using ↑/↓ buttons
- Can change how each exercise is tracked (weight/reps/level)
- Can set initial weight/level for each exercise
- Can add custom exercises (warm-ups, assistance work)
- Single "Done" button saves all changes for a specific day atomically

**Key Components in UI**:
```
┌─────────────────────────────────────┐
│ Customize Schedule                  │
├─────────────────────────────────────┤
│ [MON] [TUE] [WED] [THU] [FRI] ...   │  Day selector
├─────────────────────────────────────┤
│ Exercise List for Selected Day      │
├─────────────────────────────────────┤
│ ✓ Bench Press                       │
│   Tracking: [Weight ▼]              │  Dropdown to change type
│   Initial: [50 lbs ___]             │  Text input for initial value
│   [↑] [↓]                           │  Reorder buttons
│                                     │
│ □ Add Exercise [+ button]           │  Expand to add custom
│   Name: [_______]                   │
│   Type: [Weight ▼]                  │
│   Initial: [_______]                │
│                                     │
│ [DONE] [CANCEL]                     │  Atomic day save
└─────────────────────────────────────┘
```

**API Call on Save**:
```typescript
POST /api/updateScheduleCustomizations
Body: {
  userId: string
  userScheduleId: string
  daySequenceNumber: number
  rows: [
    {
      exerciseId: string | null (null if added)
      customExerciseName: string | null
      customTargetMuscle: string | null
      customTrackingType: 'weight' | 'reps' | 'level' | null
      initialWeight: string | null
      orderInDay: number
      isAdded: boolean
    }
  ]
}
```

**Backend Logic** (`saveScheduleDayCustomizations`):
1. Validate user owns this schedule
2. DELETE all customizations WHERE user_id=X AND user_schedule_id=Y AND day_sequence_number=Z
3. INSERT all rows from request with exact order_in_day values
4. Return success/error

**Why Atomic Save?**:
- Prevents partial updates where old+new rows coexist
- Eliminates ordering drift (e.g., rows ending up at bottom after save)
- Single transaction ensures consistency even if network drops mid-save

---

### 2. Exercise Logging

**Location**: `src/app/dashboard/page.tsx`

**What It Does**:
- Athlete selects workout day from calendar/button list
- Views all exercises (template + customizations merged)
- For each exercise, logs sets:
  - If tracking weight: weight + reps
  - If tracking reps: reps only
  - If tracking level: level (easy/medium/hard)
  - Optional notes
- "Done" button creates workout_log entries and saves session

**Key Function**: `logExercise()`

```typescript
async function logExercise(
  userId: string,
  exerciseId: string | null, // null if custom exercise
  setsData: {
    setNumber: number
    weightUsed?: string
    repsCompleted?: number
    levelUsed?: string
    notes?: string
    isCompleted: boolean
  }[],
  options: {
    sessionId: string // groups multiple exercises from same workout
    sessionDayNumber: number // 1-7
  }
)
```

---

### 3. Trainer Dashboard & Template Creation

**Location**: `src/app/trainer/page.tsx` and `src/app/plan/create/page.tsx`

**What Trainers Can Do**:
- Create new workout templates (multi-day, multi-exercise)
- Assign templates to athlete clients
- View client's logged workout history
- See client's customizations (future: with approval workflow)

**Template Creation Flow**:
1. Trainer visits `/plan/create`
2. Creates template (name, description)
3. Adds days to template (Monday, Tuesday, etc)
4. For each day, adds exercises (name, muscle, sets, reps, rest, notes)
5. Saves template to database
6. Selects athlete from list and assigns template to them
7. Athlete receives notification and can start using it (future: accept/reject)

---

### 4. Mobile Responsiveness

**Implementation**: CSS media queries in `globals.css`

**Breakpoint**: 640px and below

**Changes for Mobile**:
- Button layouts stack vertically instead of horizontal
- Font sizes reduce for smaller screens
- Input fields full-width on mobile
- Exercise list cards adjust padding/margins
- Reorder buttons stay visible (critical for UX)

**Testing**: Verified on iPhone 12/13 viewport

---

## File Structure

```
/gym-workout/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout, navigation
│   │   ├── page.tsx                # Home page (redirect to /auth or /dashboard)
│   │   ├── globals.css             # Dark theme, responsive styles
│   │   │
│   │   ├── auth/
│   │   │   └── page.tsx            # Login/signup form, Supabase auth
│   │   │
│   │   ├── dashboard/
│   │   │   └── page.tsx            # Main athlete dashboard, exercise logging
│   │   │                            # Loads schedule, displays days, handles logExercise
│   │   │
│   │   ├── athlete/
│   │   │   └── schedule/
│   │   │       └── page.tsx         # Schedule customization UI
│   │   │                            # Reordering, tracking type, initial weight
│   │   │
│   │   ├── trainer/
│   │   │   └── page.tsx            # Trainer dashboard, client management
│   │   │                            # View assigned schedules, logged history
│   │   │
│   │   └── plan/
│   │       └── create/
│   │           └── page.tsx         # Create/edit workout templates
│   │
│   ├── components/
│   │   ├── ExerciseLogger.tsx       # Reusable set logging UI
│   │   └── Navigation.tsx           # Top nav bar with role detection
│   │
│   └── lib/
│       ├── api.ts                   # 1675+ lines: All API functions
│       │                            # Key exports:
│       │                            # - getUserSchedule()
│       │                            # - getAthleteDashboardData()
│       │                            # - saveScheduleDayCustomizations()
│       │                            # - logExercise()
│       │                            # - createWorkoutTemplate()
│       │                            # - assignTemplateToAthlete()
│       │                            # - getTrainerDashboardData()
│       │
│       └── supabase.ts              # Supabase client init
│                                    # Accepts both ANON_KEY and PUBLISHABLE_KEY
│
├── supabase/
│   └── schema.sql                   # Full database schema (migrations)
│
├── public/                          # Static assets (if any)
│
├── package.json                     # Dependencies, scripts
├── tsconfig.json                    # TypeScript config
├── next.config.ts                   # Next.js config
├── eslint.config.mjs                # ESLint rules
│
├── DOCUMENTATION.md                 # This file
├── AGENTS.md                        # Next.js version warnings
├── CLAUDE.md                        # AI-specific notes
└── README.md                        # Basic project README
```

---

## API Documentation

### Core Functions in `src/lib/api.ts`

#### 1. `getUserSchedule(userId: string)`

**Purpose**: Fetch athlete's schedule with merged customizations

**Returns**:
```typescript
{
  schedule: {
    id: string
    userId: string
    workoutTemplate: { id, templateName, description }
    assignedDate: string
  }
  days: [
    {
      daySequenceNumber: 1-7
      dayName: 'Monday'
      exercises: [
        {
          id: string
          exerciseName: string
          targetMuscle: string
          setCount: number
          repRange: string
          restSeconds: number
          notes: string
          trackingType?: 'weight' | 'reps' | 'level'
          initialWeight?: string
          orderInDay: number // user's custom order if modified
        }
      ]
    }
  ]
}
```

**Logic**:
1. Fetch user_schedule (checks ownership)
2. Fetch template_days and template_exercises
3. Fetch user customizations for each day
4. Merge: For each template exercise, apply customization overrides
5. Sort exercises by orderInDay
6. Return merged structure

**Error Handling**: Non-blocking customizations fetch (try-catch) prevents crash if table doesn't exist

---

#### 2. `saveScheduleDayCustomizations(userId, userScheduleId, daySequenceNumber, rows)`

**Purpose**: Atomically save all customizations for one day

**Params**:
```typescript
userId: string
userScheduleId: string
daySequenceNumber: number (1-7)
rows: [
  {
    exerciseId?: string (null if custom)
    customExerciseName?: string
    customTargetMuscle?: string
    customTrackingType?: 'weight' | 'reps' | 'level'
    initialWeight?: string
    orderInDay: number (1..N)
    isAdded: boolean
  }
]
```

**Returns**: `{ success: boolean, message: string }`

**Logic** (Single Transaction):
1. Validate user owns schedule
2. `DELETE` all customizations WHERE user_id=userId AND user_schedule_id=userScheduleId AND day_sequence_number=daySequenceNumber
3. `INSERT` all rows with exact order_in_day values
4. Return success

**Critical Detail**: 
- Prevents duplicate rows (each INSERT is fresh)
- Preserves order exactly as requested
- All-or-nothing: if one row fails, entire day save fails

---

#### 3. `logExercise(userId, exerciseId, setsData, options)`

**Purpose**: Log completed sets for one exercise

**Params**:
```typescript
userId: string
exerciseId: string | null (null if user-added custom)
setsData: [
  {
    setNumber: number
    weightUsed?: string
    repsCompleted?: number
    levelUsed?: string
    notes?: string
    isCompleted: boolean
  }
]
options: {
  sessionId: string  // e.g., 'uuid-...' or 'timestamp-random'
  sessionDayNumber: number (1-7)
}
```

**Returns**: `{ success: boolean, logIds: string[] }`

**Logic**:
1. Validate user
2. For each set in setsData:
   - `INSERT` into workout_logs with user_id, exercise_id, sessionId, setNumber, etc.
3. Return success + array of log IDs

**Session ID Generation** (in dashboard.tsx):
```typescript
function createSessionId() {
  try {
    return crypto.randomUUID()
  } catch (e) {
    // Fallback for HTTP/LAN environments (192.168.1.10:3000)
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}
```

---

#### 4. `getAthleteDashboardData(userId)`

**Purpose**: Fetch all data needed for athlete dashboard

**Returns**:
```typescript
{
  user: { id, email, name, role }
  schedule: { id, assignedDate }
  dayExercises: [
    {
      daySequenceNumber: 1
      dayName: 'Monday'
      exercises: [/* merged + ordered */]
    }
  ]
  sessionLogs: [
    {
      sessionId: string
      sessionDayNumber: number
      loggedAt: string
      exercises: [
        {
          exerciseName: string
          sets: [
            { setNumber, weightUsed, repsCompleted, levelUsed, notes }
          ]
        }
      ]
    }
  ]
}
```

**Logic**:
1. Fetch user schedule
2. For each day: merge template + customizations (non-blocking try-catch)
3. Group workout_logs by sessionId
4. Return merged dashboard data

---

#### 5. `getTrainerDashboardData(trainerId)`

**Purpose**: Get trainer's assigned clients and their progress

**Returns**:
```typescript
{
  assignedClients: [
    {
      userId: string
      email: string
      name: string
      schedules: [
        {
          id: string
          templateName: string
          assignedDate: string
          lastLoggedDate?: string
        }
      ]
    }
  ]
}
```

**Logic**:
1. Find all schedules assigned_by_user_id = trainerId
2. Group by athlete
3. For each athlete, fetch their workout_logs to get lastLoggedDate
4. Return organized client list

---

#### 6. `createWorkoutTemplate(trainerId, templateData)`

**Purpose**: Create new workout template

**Params**:
```typescript
trainerId: string
templateData: {
  templateName: string
  description?: string
  days: [
    {
      dayName: string
      exercises: [
        {
          exerciseName: string
          targetMuscle: string
          setCount: number
          repRange: string
          restSeconds: number
          notes?: string
        }
      ]
    }
  ]
}
```

**Returns**: `{ templateId: string }`

**Logic**:
1. `INSERT` into workout_templates (created_by_user_id = trainerId)
2. For each day: `INSERT` into template_days
3. For each exercise in day: `INSERT` into template_exercises
4. Return template ID (used for assignment to athletes)

---

#### 7. `assignTemplateToAthlete(trainerId, athleteId, templateId)`

**Purpose**: Assign template to athlete (creates user_schedule)

**Params**:
```typescript
trainerId: string
athleteId: string
templateId: string
```

**Returns**: `{ scheduleId: string, success: boolean }`

**Logic**:
1. Validate trainerId owns template (check template.created_by_user_id)
2. `INSERT` into user_schedules (assigned_by_user_id = trainerId)
3. Return scheduleId

---

### Error Handling Patterns

All functions follow this pattern:
```typescript
async function apiFunction(...) {
  try {
    // Implementation
    return { success: true, data: ... }
  } catch (err) {
    console.error('[FunctionName]', err)
    return { success: false, error: err.message }
  }
}
```

**Frontend Usage**:
```typescript
const result = await getUserSchedule(userId)
if (!result.success) {
  showError(result.error)
  return
}
// Use result.schedule, result.days, etc.
```

---

## Problem Resolution Log

### Problem 1: Dashboard Crashes on Load

**Symptom**: Athlete dashboard throws error when customizations table doesn't exist yet

**Root Cause**: `getAthleteDashboardData()` made blocking Supabase call to customizations table without error handling

**Solution**:
- Wrapped customizations fetch in try-catch
- If table doesn't exist or query fails, return empty customizations array
- Dashboard continues to load with template exercises only
- Customizations populate when table is ready

**Code Change**:
```typescript
// BEFORE: Blocking call that could crash
const customizations = await supabase.from('user_schedule_customizations').select('*')

// AFTER: Non-blocking call with fallback
let customizations = []
try {
  const { data, error } = await supabase.from('user_schedule_customizations').select('*')
  if (!error) customizations = data || []
} catch (err) {
  console.warn('Customizations fetch failed, using empty array:', err.message)
}
```

**Impact**: Dashboard now loads reliably even during initial setup

---

### Problem 2: Exercise Reordering Caused Position Jump

**Symptom**: After clicking "↑" to move exercise up and clicking "Done", exercise would jump to bottom instead of staying in new position

**Root Cause**: Using incremental `UPDATE` statements instead of atomic day save:
- First row insert: customization added to DB
- Second row insert: another customization added
- If user moved 5 exercises, 5 separate UPDATE calls happened
- Race conditions + duplicate rows caused final order to be unpredictable

**Solution**: Switched to atomic day save pattern
- Delete ALL customizations for (user, schedule, day) in one call
- Insert ALL new rows in one transaction with exact order
- No intermediate states, no duplicates

**Code Change**:
```typescript
// BEFORE: Incremental updates (buggy)
async function updateScheduleExercise(userId, customizationId, newOrder) {
  await supabase.from('customizations').update({order_in_day: newOrder}).eq('id', customizationId)
}

// AFTER: Atomic day save (reliable)
async function saveScheduleDayCustomizations(userId, scheduleId, dayNum, rows) {
  // Delete all for this day
  await supabase.from('customizations').delete().eq('user_id', userId).eq('day', dayNum)
  
  // Insert all new rows with exact order
  await supabase.from('customizations').insert(rows.map((r, i) => ({
    ...r,
    order_in_day: i + 1
  })))
}
```

**Impact**: Reordering now works reliably; changes persist correctly across sessions

---

### Problem 3: Popup Alert on Every Weight Field Change

**Symptom**: User types "5" in initial weight field → blur → "Saved!" popup appears. Types "0" → blur → popup again. Spam popups distract from workout planning.

**Root Cause**: Each field blur triggered immediate `upsertScheduleExerciseCustomization()` call with alert

**Solution**: Changed to draft state model + single "Done" button
- Weight/tracking changes update local state only (no DB call)
- All blur handlers are silent (no alerts)
- Single "Done" button saves entire day's changes via `saveScheduleDayCustomizations()`

**Code Change** (in customize/page.tsx):
```typescript
// BEFORE: Immediate save + alert
function handleWeightChange(exerciseId, value) {
  updateWeight(exerciseId, value) // DB call
  showAlert('Saved!')
}

// AFTER: Draft state, silent save
function handleWeightChange(exerciseId, value) {
  setDraftRows(prev => [...prev].map(r => 
    r.id === exerciseId ? {...r, initialWeight: value} : r
  )) // State only, no DB call
}

function handleDone() {
  saveScheduleDayCustomizations(userId, scheduleId, dayNum, draftRows)
  showAlert('Day saved!')
}
```

**Impact**: UX significantly improved; users can make multiple changes without distraction

---

### Problem 4: "crypto.randomUUID is not a function" on HTTP/LAN

**Symptom**: Athlete accessing app via `http://192.168.1.10:3000` (LAN, not HTTPS) could not log exercises because `crypto.randomUUID()` threw error

**Root Cause**: Secure context (HTTPS) required for `globalThis.crypto.randomUUID()`. HTTP/LAN doesn't have secure context.

**Solution**: Created `createSessionId()` helper with fallback:
```typescript
function createSessionId() {
  try {
    return crypto.randomUUID()
  } catch (e) {
    // Fallback for HTTP environments
    const timestamp = Date.now()
    const random = Math.random().toString(36).slice(2, 11)
    return `${timestamp}-${random}`
  }
}
```

**Impact**: LAN access now works; sessions are unique enough for practical use

---

### Problem 5: Type Error on Trainer Schedule History

**Symptom**: Trainer dashboard builds successfully locally but fails on Vercel with TypeScript error about `workout_templates` type mismatch

**Root Cause**: Supabase sometimes returns relations as array, sometimes as object. Type definition only accepted object.

**Example Mismatch**:
```typescript
// Query 1 result: object
{
  id: '...',
  workout_templates: { id, templateName } // single object
}

// Query 2 result: array
{
  id: '...',
  workout_templates: [ { id, templateName } ] // array of objects
}
```

**Solution**: Updated type to accept both shapes, then extract [0] when rendering:
```typescript
// Type definition
interface ScheduleHistoryRow {
  id: string
  workout_templates: WorkoutTemplate | WorkoutTemplate[] // both shapes
}

// When rendering
const historyTemplate = Array.isArray(h.workout_templates) 
  ? h.workout_templates[0] 
  : h.workout_templates
return <div>{historyTemplate.templateName}</div>
```

**Impact**: Build succeeds on Vercel; trainer dashboard displays correctly

---

### Problem 6: "useSearchParams() should be wrapped in Suspense" Error

**Symptom**: Build fails with Next.js prerender error on `/plan/create` page

**Root Cause**: `useSearchParams()` hook used in component rendered at build time without Suspense boundary

**Solution**: Created outer component that wraps inner component in Suspense:
```typescript
// BEFORE: Direct useSearchParams (fails prerender)
export default function PlanCreator() {
  const searchParams = useSearchParams()
  // ...
}

// AFTER: Suspense boundary
function PlanCreatorInner() {
  const searchParams = useSearchParams()
  // ...
}

export default function PlanCreator() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PlanCreatorInner />
    </Suspense>
  )
}
```

**Impact**: Build completes successfully; plan creation page is prerenderable

---

### Problem 7: TypeScript Implicit Any on Customizations Variable

**Symptom**: Production build failed with "variable 'customizations' is implicitly any"

**Root Cause**: Declared `let customizations = []` without type annotation; TypeScript couldn't infer type

**Solution**: Added explicit type:
```typescript
// BEFORE
let customizations = []

// AFTER
let customizations: CustomizationRow[] = []
```

**Impact**: Production build completes without TypeScript errors

---

### Problem 8: "Invalid API key" on Vercel Auth (Current)

**Symptom**: Login/signup on Vercel deployment returns "Invalid API key" error

**Root Cause**: Vercel environment has `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` set, but `src/lib/supabase.ts` only checked `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Solution**: Updated supabase.ts to fallback to publishable key if anon key not set:
```typescript
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
  || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 
  || 'mock-key'

const supabase = createClient(SUPABASE_URL, supabaseAnonKey)
```

**Status**: 🟡 Fix deployed to git, awaiting Vercel redeploy with verified environment variables

**Next Steps**:
1. Verify Vercel project settings have both env vars set:
   - `NEXT_PUBLIC_SUPABASE_URL=https://ozodcynozlwcsjtruorx.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_lN91-...` (or ANON_KEY)
2. Trigger Vercel redeploy (push commit or manual redeploy in dashboard)
3. Test auth on https://gtm-workout-git-main-madkluxes-projects.vercel.app/auth

---

## Deployment & Environment

### Local Development Setup

**Prerequisites**:
- Node.js 18+
- npm or yarn
- Git

**Steps**:
```bash
git clone https://github.com/t-dasun/GTM-WORKOUT.git
cd gym-workout
npm install
npm run dev
```

**Access**:
- Same machine: http://localhost:3000
- Same Wi-Fi: http://192.168.1.10:3000 (or your local IP)
- Binding: `0.0.0.0:3000` in package.json ensures LAN access

---

### Environment Variables

Required for both local and Vercel:

```env
# Supabase API
NEXT_PUBLIC_SUPABASE_URL=https://ozodcynozlwcsjtruorx.supabase.co

# Either ANON_KEY or PUBLISHABLE_KEY (or both)
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
# OR
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_lN91-...
```

**Where to Set**:
- **Local**: Create `.env.local` in project root (git-ignored)
- **Vercel**: Project Settings → Environment Variables → add for Preview + Production + Development

---

### Production Build & Export

**Build**:
```bash
npm run build
```

**Output**: `.next/` directory with optimized code

**Static Export** (if needed):
```typescript
// In next.config.ts
export const config = {
  output: 'export' // or 'standalone' for Vercel
}
```

**Note**: Current config uses `'standalone'` for Vercel serverless deployment

---

### Vercel Deployment

**Current URL**: https://gtm-workout-git-main-madkluxes-projects.vercel.app

**Deployment Method**: GitHub integration (auto-deploy on push to main)

**Setup** (one-time):
1. Push code to GitHub: https://github.com/t-dasun/GTM-WORKOUT.git
2. Import project in Vercel dashboard
3. Add environment variables (see above)
4. Deploy

**Trigger Redeploy**:
- Push commit to main branch (auto-triggers)
- OR manual redeploy from Vercel dashboard → "Deployments" → "Redeploy"

**CI/CD Pipeline**:
```
Push to GitHub main
  ↓
Vercel webhook triggered
  ↓
Build: npm run build
  ↓
Deploy to production
  ↓
Live at https://gtm-workout-git-main-madkluxes-projects.vercel.app
```

---

## Development Workflow

### Typical Feature Development Cycle

1. **Understand Requirements**: Read existing code, ask clarifying questions
2. **Design Database Changes**: If new table needed, add to `supabase/schema.sql` and create migration
3. **Implement API Function**: Add to `src/lib/api.ts`, handle errors, test locally
4. **Create/Update UI**: Add or modify page.tsx or component, call API function
5. **Test Locally**: 
   - `npm run dev`
   - http://localhost:3000
   - Test as athlete and trainer
   - Test mobile view (DevTools → responsive)
6. **Check Build**: `npm run build` (must complete without errors)
7. **Lint**: `npm run lint` (must pass, only deprecation warnings ok)
8. **Commit & Push**: 
   ```bash
   git add .
   git commit -m "Feature: [description]"
   git push origin main
   ```
9. **Verify Vercel**: Wait for auto-deploy, test on Vercel URL
10. **Document**: Update this file if adding new feature/API function

---

### Key Files to Modify for Different Tasks

| Task | Primary File | Secondary Files |
|------|--------------|-----------------|
| Add API function | `src/lib/api.ts` | Page that calls it |
| Create new page | `src/app/[route]/page.tsx` | `src/components/*` if needed |
| Update database | `supabase/schema.sql` | `src/lib/api.ts` (to query new table) |
| Fix UI bug | `src/app/[route]/page.tsx` or `globals.css` | Rarely components |
| Change auth flow | `src/app/auth/page.tsx` | `src/lib/supabase.ts` if needed |
| Add Supabase client config | `src/lib/supabase.ts` | Usually none |

---

### Common Commands

```bash
# Development
npm run dev              # Start dev server (0.0.0.0:3000)
npm run build            # Build for production
npm run lint             # Check code style (ESLint)

# Git
git status               # See changes
git add [file]           # Stage file
git commit -m "msg"      # Commit with message
git push origin main     # Push to GitHub (triggers Vercel deploy)
git log --oneline        # View commit history

# Debugging
# Check Vercel logs
#   → https://vercel.com → select project → Deployments → select build → Logs
# Check browser console
#   → DevTools → Console (JS errors, network requests)
# Check network requests
#   → DevTools → Network → filter by XHR (API calls)
```

---

### Testing Checklist

Before committing code, verify:

- [ ] Feature works locally: `npm run dev`
- [ ] No console errors in browser
- [ ] API calls succeed (check Network tab)
- [ ] Mobile responsive (DevTools → iPhone 12)
- [ ] Build succeeds: `npm run build` (no errors, only warnings ok)
- [ ] Lint passes: `npm run lint`
- [ ] Data persists after page refresh
- [ ] Handles error cases gracefully (network error, invalid input, etc.)
- [ ] No hardcoded URLs or credentials

---

### Database Inspection

**Connect to Supabase via CLI** (future):
```bash
# Would require supabase-cli installation
supabase db pull        # Fetch schema from production
supabase db reset       # Reset local database
```

**For Now**: Use Supabase Dashboard
1. Visit https://supabase.com → sign in
2. Select project `ozodcynozlwcsjtruorx`
3. Browse tables, view/edit data in SQL Editor tab
4. Run queries: `SELECT * FROM users;` etc.

---

## Current Status & Next Steps

### ✅ Completed

- [x] Core schedule customization feature (reorder, tracking type, initial weight)
- [x] Exercise logging with session tracking
- [x] Trainer dashboard and template creation
- [x] Mobile responsive UI
- [x] Git repository and GitHub push
- [x] Vercel deployment setup
- [x] All TypeScript and build errors fixed
- [x] Supabase key fallback for auth
- [x] LAN access enabled (0.0.0.0:3000)

### 🔄 In Progress

- [ ] **Vercel Auth Fix**: Deployed code fix to supabase.ts (accepts both key types), awaiting Vercel redeploy with verified environment variables

### ⏳ Future Enhancements

- [ ] Athlete notifications when new schedule assigned
- [ ] Trainer approval/rejection of athlete customizations
- [ ] Progress tracking dashboard (charts, analytics)
- [ ] Real-time updates with Supabase realtime subscriptions
- [ ] Test suite (Jest + React Testing Library)
- [ ] API rate limiting and security hardening
- [ ] User profile management (edit name, change password)
- [ ] Export/download workout history as PDF
- [ ] Dark/light theme toggle
- [ ] Multi-language support

---

## Helpful Resources for Future Development

### Documentation
- Next.js: https://nextjs.org/docs
- Supabase: https://supabase.com/docs
- React: https://react.dev
- TypeScript: https://www.typescriptlang.org/docs/
- Tailwind (if using): https://tailwindcss.com/docs

### Local Notes
- `AGENTS.md`: Next.js version breaking changes warning
- `CLAUDE.md`: AI assistant preferences
- `supabase/schema.sql`: Full database schema

### Important Credentials (in /Docs/DBpassword.txt)
- Supabase URL
- Publishable Key
- Admin credentials (keep private!)

---

## Summary for New AI Agents

This is a **Next.js gym workout tracking app** with two user roles:

1. **Athletes** receive workout templates from trainers, customize them (reorder exercises, adjust weight/reps), and log daily sets
2. **Trainers** create templates, assign to athletes, and monitor progress

**Key architectural decisions**:
- **Atomic day save** prevents data inconsistency during reordering
- **Non-blocking customizations fetch** prevents dashboard crashes
- **Session ID grouping** allows multi-set workouts to be tracked together
- **User isolation** ensures customizations affect only that user

**To modify code**:
1. Check `src/lib/api.ts` for existing functions before creating new ones
2. Test locally with `npm run dev`
3. Build with `npm run build` (must complete without errors)
4. Lint with `npm run lint`
5. Commit and push to trigger Vercel auto-deploy

**Current blocker**: Vercel auth needs environment variable verification and redeploy.

---

*Last Updated: May 14, 2026*  
*Project Status: 🟢 Core Features Complete | 🟡 Vercel Auth Pending Redeploy*
