import { supabase } from './supabase'

export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) throw error
  return session
}

export async function getUserProfile(userId: string) {
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).single()
  if (data) {
    const { data: tc } = await supabase
      .from('trainer_clients')
      .select('trainer_id, status, created_at')
      .eq('client_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    data.trainer_id = tc?.status === 'approved' ? tc.trainer_id : null
    data.trainer_link_trainer_id = tc?.trainer_id || null
    data.trainer_link_status = tc?.status || null
  }
  return { data, error }
}

export async function updateUserProfile(userId: string, updates: { full_name?: string, gender?: string | null, weight?: number | null, whatsapp?: string | null }) {
  const payload: Record<string, string | number | null> = {}

  if (typeof updates.full_name === 'string') payload.full_name = updates.full_name
  if (typeof updates.gender !== 'undefined') payload.gender = updates.gender
  if (typeof updates.weight !== 'undefined') payload.weight = updates.weight
  if (typeof updates.whatsapp !== 'undefined') payload.whatsapp = updates.whatsapp

  const { data, error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', userId)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function getUpcomingWorkout(userId: string) {
  // Check if user has an active schedule
  const { data: schedule, error: scheduleError } = await supabase
    .from('user_schedules')
    .select('template_id, day_of_week_mapping')
    .eq('user_id', userId)
    .single()
    
  if (scheduleError || !schedule) {
    return { hasSchedule: false, data: null }
  }

  // Get template details
  const { data: template } = await supabase
    .from('workout_templates')
    .select('*')
    .eq('id', schedule.template_id)
    .single()
    
  // A simplified queue system logic: just fetch the first template day for now
  // Real logic would look at workout_logs to find the next uncompleted day
  const { data: templateDay } = await supabase
    .from('template_days')
    .select('*')
    .eq('template_id', schedule.template_id)
    .order('day_sequence_number', { ascending: true })
    .limit(1)
    .single()
    
  if (!templateDay) return { hasSchedule: true, data: null }

  // Get exercises for that day
  const { data: templateExercises } = await supabase
    .from('template_exercises')
    .select(`
      id,
      sets_data,
      order_in_day,
      exercises (id, name, tracking_type)
    `)
    .eq('template_day_id', templateDay.id)
    .order('order_in_day', { ascending: true })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exercises = templateExercises?.map((te: any) => ({
    id: te.exercises.id, // We use the actual exercise ID for logging
    name: te.exercises.name,
    trackingType: te.exercises.tracking_type || 'weight',
    setsData: te.sets_data || []
  })) || []

  return {
    hasSchedule: true,
    data: {
      dayName: `${template?.name || 'Workout'} - Day ${templateDay.day_sequence_number}`,
      exercises
    }
  }
}

export async function getAthleteDashboardData(userId: string) {
  const { data: schedule, error: scheduleError } = await supabase
    .from('user_schedules')
    .select('id, template_id, day_of_week_mapping, workout_templates(name, level)')
    .eq('user_id', userId)
    .single()

  if (scheduleError || !schedule) {
    return { hasSchedule: false, data: null }
  }

  // Fetch customizations for this user's schedule - non-blocking (table may not exist yet)
  let customizations = []
  try {
    const { data: customizationsData } = await supabase
    .from('user_schedule_customizations')
    .select(`
      id,
      day_sequence_number,
      exercise_id,
      is_added,
      custom_tracking_type,
      initial_weight,
      order_in_day,
      exercises (
        id,
        name,
        tracking_type,
        exercise_muscle_groups (
          muscle_groups ( id, name )
        )
      )
    `)
    .eq('user_id', userId)
    .eq('user_schedule_id', schedule.id)

    customizations = customizationsData || []
  } catch {
    // Customizations table may not exist yet - that's OK, proceed without them
    customizations = []
  }

  const { data: templateDays, error: templateDaysError } = await supabase
    .from('template_days')
    .select(`
      id,
      day_sequence_number,
      template_exercises (
        id,
        exercise_id,
        sets_data,
        order_in_day,
        exercises (
          id,
          name,
          tracking_type,
          exercise_muscle_groups (
            muscle_groups ( id, name )
          )
        )
      )
    `)
    .eq('template_id', schedule.template_id)

  if (templateDaysError) throw templateDaysError

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortedDays = (templateDays || []).sort((a: any, b: any) => a.day_sequence_number - b.day_sequence_number)

  // Build customizations by day for easy lookup
  const customizationsByDay: Record<number, typeof customizations> = {}
  customizations.forEach(c => {
    if (!customizationsByDay[c.day_sequence_number]) {
      customizationsByDay[c.day_sequence_number] = []
    }
    customizationsByDay[c.day_sequence_number].push(c)
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const days = sortedDays.map((day: any) => {
    const dayCustomizations = customizationsByDay[day.day_sequence_number] || []
    const overridesByExerciseId = new Map(
      dayCustomizations
        .filter(c => !c.is_added)
        .map(c => [c.exercise_id, c])
    )

    // Get template exercises
    const templateExercises = (day.template_exercises || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => a.order_in_day - b.order_in_day)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((te: any) => ({
        id: te.exercises?.id,
        name: te.exercises?.name || 'Exercise',
        orderInDay: overridesByExerciseId.get(te.exercise_id)?.order_in_day ?? te.order_in_day,
        trackingType: overridesByExerciseId.get(te.exercise_id)?.custom_tracking_type || te.exercises?.tracking_type || 'weight',
        setsData: overridesByExerciseId.get(te.exercise_id)?.initial_weight != null
          ? [{ setNumber: 1, reps: 1, weight: Number(overridesByExerciseId.get(te.exercise_id)?.initial_weight || 0) }]
          : (te.sets_data || []),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        muscleGroups: (te.exercises?.exercise_muscle_groups || []).map((emg: any) => emg.muscle_groups).filter(Boolean),
        isCustom: false
      }))

    // Get user-added custom exercises for this day
    const customExercises = dayCustomizations
      .filter(c => c.is_added)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => a.order_in_day - b.order_in_day)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((c: any) => ({
        id: c.exercises?.id,
        name: c.exercises?.name || 'Exercise',
        orderInDay: c.order_in_day,
        trackingType: c.custom_tracking_type || c.exercises?.tracking_type || 'weight',
        setsData: c.initial_weight != null ? [{ setNumber: 1, reps: 1, weight: c.initial_weight }] : [],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        muscleGroups: (c.exercises?.exercise_muscle_groups || []).map((emg: any) => emg.muscle_groups).filter(Boolean),
        isCustom: true,
        customizationId: c.id
      }))

    const mergedExercises = [...templateExercises, ...customExercises]
      .sort((a, b) => Number(a.orderInDay || 0) - Number(b.orderInDay || 0))

    return {
      id: day.id,
      dayNumber: day.day_sequence_number,
      exercises: mergedExercises
    }
  })

  if (days.length === 0) {
    return { hasSchedule: true, data: null }
  }

  const allExerciseIds = days
    .flatMap(day => day.exercises.map(ex => ex.id))
    .filter(Boolean)

  const latestByDayExerciseSet: Record<number, Record<string, Record<number, { reps: number | null, weight: number | null }>>> = {}
  const bestByExercise: Record<string, { reps: number | null, weight: number | null }> = {}
  type LogRow = {
    exercise_id: string
    reps_completed: number | null
    weight_used: number | null
    sets_completed: number | null
    timestamp: string
    session_id?: string | null
    session_day_number?: number | null
  }
  let logs: LogRow[] = []

  // Fetch ALL user logs (not just current template) for accurate insights
  const { data: allLogsData, error: allLogsErr } = await supabase
    .from('workout_logs')
    .select('exercise_id, reps_completed, weight_used, sets_completed, timestamp, session_id, session_day_number')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })

  if (allLogsErr) throw allLogsErr
  logs = (allLogsData || []) as LogRow[]

  const exerciseIdsByDay: Record<number, Set<string>> = {}
  for (const day of days) {
    exerciseIdsByDay[day.dayNumber] = new Set(day.exercises.map(ex => ex.id).filter((id): id is string => Boolean(id)))
  }

  // Build day-specific last-used defaults per set and previous best per exercise from all logs.
  if (allExerciseIds.length > 0) {
    for (const log of logs) {
      if (!allExerciseIds.includes(log.exercise_id)) continue

      const setNumber = Number(log.sets_completed || 1)
      if (typeof log.session_day_number === 'number') {
        const dayNum = log.session_day_number
        const validForDay = exerciseIdsByDay[dayNum]?.has(log.exercise_id)
        if (validForDay) {
          if (!latestByDayExerciseSet[dayNum]) latestByDayExerciseSet[dayNum] = {}
          if (!latestByDayExerciseSet[dayNum][log.exercise_id]) latestByDayExerciseSet[dayNum][log.exercise_id] = {}
          if (!latestByDayExerciseSet[dayNum][log.exercise_id][setNumber]) {
            latestByDayExerciseSet[dayNum][log.exercise_id][setNumber] = {
              reps: log.reps_completed,
              weight: log.weight_used
            }
          }
        }
      }

      if (!bestByExercise[log.exercise_id]) {
        bestByExercise[log.exercise_id] = {
          reps: log.reps_completed,
          weight: log.weight_used
        }
      }

      const existingBest = bestByExercise[log.exercise_id]
      const currentWeight = Number(log.weight_used || 0)
      const existingWeight = Number(existingBest?.weight || 0)
      const currentReps = Number(log.reps_completed || 0)
      const existingReps = Number(existingBest?.reps || 0)
      if (!existingBest || currentWeight > existingWeight || (currentWeight === existingWeight && currentReps > existingReps)) {
        bestByExercise[log.exercise_id] = {
          reps: log.reps_completed,
          weight: log.weight_used
        }
      }
    }
  }

  const daysWithHistory = days.map(day => ({
    ...day,
    exercises: day.exercises.map(ex => ({
      ...ex,
      setsData: ex.setsData.map((set: { setNumber: number, reps: number, weight: number }) => {
        const latestSet = ex.id ? latestByDayExerciseSet[day.dayNumber]?.[ex.id]?.[set.setNumber] : null
        return latestSet ? {
          ...set,
          reps: latestSet.reps ?? set.reps,
          weight: latestSet.weight ?? set.weight,
        } : set
      }),
      lastSession: ex.id ? bestByExercise[ex.id] || null : null
    }))
  }))

  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const todayName = weekDays[new Date().getDay()]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mappedBlock = (schedule.day_of_week_mapping as any)?.[todayName] || 'Rest'

  const toLocalDateKey = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const today = new Date()
  const dayOfWeek = today.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(today)
  monday.setDate(today.getDate() + mondayOffset)
  monday.setHours(0, 0, 0, 0)

  const weekDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const weekDates = weekDayNames.map((_, idx) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + idx)
    return toLocalDateKey(d)
  })

  const volumeByDate: Record<string, number> = {}
  const volumeBySession: Record<string, { sessionId: string, date: string, totalVolume: number, dayNumber: number | null }> = {}
  const loggedExerciseIdsByDate: Record<string, Set<string>> = {}
  const completedDayNumbersByDate: Record<string, Set<number>> = {}
  for (const log of logs) {
    const dateKey = toLocalDateKey(new Date(log.timestamp))
    const reps = Number(log.reps_completed || 0)
    const weight = Number(log.weight_used || 0)
    const volume = reps * weight
    volumeByDate[dateKey] = (volumeByDate[dateKey] || 0) + volume
    const sessionKey = log.session_id || `legacy:${dateKey}`
    if (!volumeBySession[sessionKey]) {
      volumeBySession[sessionKey] = {
        sessionId: sessionKey,
        date: dateKey,
        totalVolume: 0,
        dayNumber: typeof log.session_day_number === 'number' ? log.session_day_number : null
      }
    }
    volumeBySession[sessionKey].totalVolume += volume
    if (log.exercise_id) {
      if (!loggedExerciseIdsByDate[dateKey]) loggedExerciseIdsByDate[dateKey] = new Set<string>()
      loggedExerciseIdsByDate[dateKey].add(log.exercise_id)
    }
    if (typeof log.session_day_number === 'number') {
      if (!completedDayNumbersByDate[dateKey]) completedDayNumbersByDate[dateKey] = new Set<number>()
      completedDayNumbersByDate[dateKey].add(log.session_day_number)
    }
  }

  const sessionsDesc = Object.values(volumeBySession)
    .sort((a, b) => {
      const aKey = `${a.date}:${a.sessionId}`
      const bKey = `${b.date}:${b.sessionId}`
      return aKey < bKey ? 1 : -1
    })

  const lastSessionVolume = sessionsDesc.length > 0 ? sessionsDesc[0].totalVolume : 0
  const previousSessionVolume = sessionsDesc.length > 1 ? sessionsDesc[1].totalVolume : 0
  const sessionIncreased = lastSessionVolume > previousSessionVolume && previousSessionVolume > 0

  const weekLogsCount = weekDates.reduce((acc, dateKey) => acc + (volumeByDate[dateKey] ? 1 : 0), 0)

  // Streak: count backwards from yesterday if today not done yet, or from today if done
  let streak = 0
  const cursor = new Date(today)
  cursor.setHours(0, 0, 0, 0)
  const todayKey = toLocalDateKey(cursor)
  // If today not logged, start streak check from yesterday (so streak doesn't reset at midnight)
  if (!volumeByDate[todayKey]) {
    cursor.setDate(cursor.getDate() - 1)
  }
  while (true) {
    const key = toLocalDateKey(cursor)
    if (!volumeByDate[key]) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  const mappedForWeek = weekDayNames.map(dayName => {
    const value = (schedule.day_of_week_mapping as Record<string, string>)?.[dayName] || 'Rest'
    return value
  })

  // todayIdx: index in weekDayNames (Mon=0 … Sun=6)
  const todayIdx = dayOfWeek === 0 ? 6 : dayOfWeek - 1

  const getExerciseIdsForMappedDay = (mapped: string) => {
    const mappedNum = mapped.startsWith('Day ') ? Number(mapped.replace('Day ', '')) : null
    if (!mappedNum) return [] as string[]
    const day = daysWithHistory.find(d => d.dayNumber === mappedNum)
    if (!day) return [] as string[]
    return day.exercises.map(ex => ex.id).filter((id): id is string => Boolean(id))
  }

  const isDayDoneOnDate = (exerciseIds: string[], dayNumber: number | null, dateKey: string) => {
    if (dayNumber !== null) {
      const completedDaySet = completedDayNumbersByDate[dateKey]
      // If we have explicit day completion metadata for this date, trust it fully.
      // This avoids false "done late" when different workout days share exercises.
      if (completedDaySet && completedDaySet.size > 0) {
        return completedDaySet.has(dayNumber)
      }
    }

    // Legacy fallback for old logs that don't have session_day_number.
    if (exerciseIds.length === 0) return Boolean(volumeByDate[dateKey])
    const loggedIds = loggedExerciseIdsByDate[dateKey]
    if (!loggedIds) return false
    return exerciseIds.some(id => loggedIds.has(id))
  }

  const weekSummary = weekDayNames.map((dayName, idx) => {
    const mapped = mappedForWeek[idx]
    const mappedDayNumber = mapped.startsWith('Day ') ? Number(mapped.replace('Day ', '')) : null
    const exerciseIds = mapped === 'Rest' ? [] : getExerciseIdsForMappedDay(mapped)
    const doneOnScheduledDate = isDayDoneOnDate(exerciseIds, mappedDayNumber, weekDates[idx])

    if (mapped === 'Rest') {
      return { dayName, mapped, status: 'rest' as const }
    }

    if (doneOnScheduledDate) {
      return { dayName, mapped, status: 'done' as const }
    }

    // If this scheduled day was done on a later date in the same week, mark as done-late.
    if (idx < todayIdx) {
      for (let laterIdx = idx + 1; laterIdx <= todayIdx; laterIdx += 1) {
        if (isDayDoneOnDate(exerciseIds, mappedDayNumber, weekDates[laterIdx])) {
          return { dayName, mapped, status: 'done-late' as const }
        }
      }
    }

    // Past day (before today), not logged → missed
    if (idx < todayIdx) {
      return { dayName, mapped, status: 'missed' as const }
    }
    // Today, not logged yet → queued (up next)
    if (idx === todayIdx) {
      return { dayName, mapped, status: 'queued' as const }
    }
    // Future day
    return { dayName, mapped, status: 'upcoming' as const }
  })

  const mapToDayNumber = (mapped: string) => mapped.startsWith('Day ') ? Number(mapped.replace('Day ', '')) : null

  // Up next priority:
  // 1) today queued
  // 2) if today's mapped workout is done, move to next sequential template day
  // 3) earliest missed day
  // 4) next upcoming day after today
  // 5) any mapped day
  const todayEntry = weekSummary[todayIdx]
  const queuedToday = todayEntry?.status === 'queued' ? mapToDayNumber(todayEntry.mapped) : null

  const todayMappedDayNum = mapToDayNumber(mappedForWeek[todayIdx])
  let nextSequentialDayNum: number | null = null
  if (todayEntry?.status === 'done' && todayMappedDayNum) {
    const ordered = [...new Set(daysWithHistory.map(d => d.dayNumber))].sort((a, b) => a - b)
    nextSequentialDayNum = ordered.find(n => n > todayMappedDayNum) || ordered[0] || null
  }

  let missedDayNum: number | null = null
  for (let i = 0; i < weekSummary.length; i += 1) {
    if (weekSummary[i].status === 'missed') {
      missedDayNum = mapToDayNumber(weekSummary[i].mapped)
      if (missedDayNum) break
    }
  }

  let upcomingDayNum: number | null = null
  for (let i = todayIdx + 1; i < weekSummary.length; i += 1) {
    if (weekSummary[i].status === 'upcoming' || weekSummary[i].status === 'queued') {
      upcomingDayNum = mapToDayNumber(weekSummary[i].mapped)
      if (upcomingDayNum) break
    }
  }

  let anyMappedDayNum: number | null = null
  for (const mapped of mappedForWeek) {
    const n = mapToDayNumber(mapped)
    if (n) {
      anyMappedDayNum = n
      break
    }
  }

  const upNextDayNumber = queuedToday || nextSequentialDayNum || missedDayNum || upcomingDayNum || anyMappedDayNum || daysWithHistory[0].dayNumber

  const recentSessions = sessionsDesc.slice(0, 6).map((session) => ({
    id: session.sessionId,
    date: session.date,
    totalVolume: session.totalVolume,
    dayNumber: session.dayNumber,
  }))

  return {
    hasSchedule: true,
    data: {
      templateName: schedule.workout_templates?.name || 'Workout Plan',
      templateLevel: schedule.workout_templates?.level || 'General',
      todayName,
      mappedBlock,
      upNextDayNumber,
      days: daysWithHistory,
      dayMapping: schedule.day_of_week_mapping || {},
      insights: {
        estimatedDurationMin: Math.max(30, daysWithHistory.reduce((acc, d) => acc + d.exercises.length, 0) * 8),
        lastSessionVolume,
        previousSessionVolume,
        sessionIncreased,
        streak,
        weekLogsCount,
        weekSummary,
        recentSessions
      }
    }
  }
}

export async function getWorkoutHistory(userId: string, from?: string, to?: string) {
  let query = supabase
    .from('workout_logs')
    .select(`
      id, timestamp, session_id, session_day_number, sets_completed, reps_completed, weight_used,
      exercises ( id, name )
    `)
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })

  if (from) query = query.gte('timestamp', from)
  if (to) query = query.lte('timestamp', to)

  const { data, error } = await query
  if (error) throw error

  // Group by date (YYYY-MM-DD)
  const byDate: Record<string, { id: string, date: string, startedAt: string, sessionDayNumber: number | null, logs: unknown[], totalVolume: number, exerciseCount: number }> = {}
  for (const log of (data || [])) {
    const dateKey = (log.timestamp as string).slice(0, 10)
    const sessionKey = (log.session_id as string | null) || `legacy:${dateKey}`
    if (!byDate[sessionKey]) {
      byDate[sessionKey] = {
        id: sessionKey,
        date: dateKey,
        startedAt: log.timestamp as string,
        sessionDayNumber: typeof log.session_day_number === 'number' ? log.session_day_number : null,
        logs: [],
        totalVolume: 0,
        exerciseCount: 0
      }
    }
    const vol = Number(log.reps_completed || 0) * Number(log.weight_used || 0)
    byDate[sessionKey].totalVolume += vol
    byDate[sessionKey].logs.push(log)
  }

  // Count unique exercises per day
  for (const day of Object.values(byDate)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const uniq = new Set(day.logs.map((l: any) => l.exercises?.id).filter(Boolean))
    day.exerciseCount = uniq.size
  }

  return Object.values(byDate).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
}

export async function deleteWorkoutSession(userId: string, sessionId: string, fallbackDate?: string) {
  if (sessionId.startsWith('legacy:')) {
    const date = fallbackDate || sessionId.replace('legacy:', '')
    const from = `${date}T00:00:00.000Z`
    const next = new Date(`${date}T00:00:00.000Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    const to = next.toISOString()

    const { error } = await supabase
      .from('workout_logs')
      .delete()
      .eq('user_id', userId)
      .gte('timestamp', from)
      .lt('timestamp', to)

    if (error) throw error
    return
  }

  const { error } = await supabase
    .from('workout_logs')
    .delete()
    .eq('user_id', userId)
    .eq('session_id', sessionId)

  if (error) throw error
}

export async function deleteAllWorkoutLogs(userId: string) {
  const { error } = await supabase
    .from('workout_logs')
    .delete()
    .eq('user_id', userId)

  if (error) throw error
}

export async function getExerciseProgression(userId: string, exerciseId: string) {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('id, timestamp, sets_completed, reps_completed, weight_used')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .order('timestamp', { ascending: true })

  if (error) throw error

  // Group by date, compute per-set and per-session stats
  const byDate: Record<string, { date: string, sets: { setNum: number, reps: number, weight: number }[], maxWeight: number, totalVolume: number, avgWeight: number }> = {}
  for (const log of (data || [])) {
    const dateKey = (log.timestamp as string).slice(0, 10)
    if (!byDate[dateKey]) {
      byDate[dateKey] = { date: dateKey, sets: [], maxWeight: 0, totalVolume: 0, avgWeight: 0 }
    }
    const set = { setNum: log.sets_completed || 1, reps: Number(log.reps_completed || 0), weight: Number(log.weight_used || 0) }
    byDate[dateKey].sets.push(set)
    byDate[dateKey].totalVolume += set.reps * set.weight
    if (set.weight > byDate[dateKey].maxWeight) byDate[dateKey].maxWeight = set.weight
  }

  for (const day of Object.values(byDate)) {
    const weights = day.sets.map(s => s.weight).filter(w => w > 0)
    day.avgWeight = weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : 0
  }

  return Object.values(byDate).sort((a, b) => (a.date < b.date ? -1 : 1))
}

export async function getLoggedExercises(userId: string) {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('exercise_id, exercises(id, name)')
    .eq('user_id', userId)

  if (error) throw error

  const seen = new Map<string, { id: string, name: string }>()
  for (const row of (data || [])) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ex = (row as any).exercises
    if (ex?.id && !seen.has(ex.id)) seen.set(ex.id, ex)
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name))
}

export async function logExercise(
  userId: string,
  exerciseId: string,
  setsData: Array<{ setNumber: number, reps: number, weight: number }>,
  options?: { sessionId?: string | null, sessionDayNumber?: number | null }
) {
  const inserts = setsData.map(set => ({
    user_id: userId,
    exercise_id: exerciseId,
    session_id: options?.sessionId || null,
    session_day_number: options?.sessionDayNumber || null,
    sets_completed: set.setNumber,
    reps_completed: set.reps,
    weight_used: set.weight,
    timestamp: new Date().toISOString()
  }))
  
  const { data, error } = await supabase.from('workout_logs').insert(inserts)
  
  if (error) throw error
  return data
}

export async function getMuscleGroups() {
  const { data, error } = await supabase.from('muscle_groups').select('id, name').order('name')
  if (error) throw error
  return data || []
}

export async function createMuscleGroup(name: string) {
  const { data: existing } = await supabase
    .from('muscle_groups')
    .select('id')
    .ilike('name', name.trim())
    .maybeSingle()

  if (existing) throw new Error('A muscle group with this name already exists.')

  const { data, error } = await supabase
    .from('muscle_groups')
    .insert({ name: name.trim() })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateExercise(
  userId: string,
  exerciseId: string,
  name: string,
  muscleGroupIds: string[],
  trackingType: 'weight' | 'level',
  options?: { allowGlobalEdit?: boolean }
) {
  // Only creator or global (admin-like) can edit — here we allow creator only
  const { data: ex, error: fetchErr } = await supabase
    .from('exercises')
    .select('id, is_global, created_by_user_id')
    .eq('id', exerciseId)
    .single()

  if (fetchErr) throw fetchErr
  if (ex.is_global && !options?.allowGlobalEdit) {
    throw new Error('A trainer pass is required to edit global exercises.')
  }
  if (!ex.is_global && ex.created_by_user_id !== userId) {
    throw new Error('You can only edit exercises you created.')
  }

  const { error: updateErr } = await supabase
    .from('exercises')
    .update({ name: name.trim(), tracking_type: trackingType })
    .eq('id', exerciseId)

  if (updateErr) throw updateErr

  // Replace muscle group links
  await supabase.from('exercise_muscle_groups').delete().eq('exercise_id', exerciseId)

  if (muscleGroupIds.length > 0) {
    const inserts = muscleGroupIds.map(mgId => ({
      exercise_id: exerciseId,
      muscle_group_id: mgId
    }))
    const { error: mgErr } = await supabase.from('exercise_muscle_groups').insert(inserts)
    if (mgErr) throw mgErr
  }
}

export async function getExercises(userId?: string) {
  const { data, error } = await supabase
    .from('exercises')
    .select(`
      id,
      name,
      tracking_type,
      is_global,
      created_by_user_id,
      exercise_muscle_groups (
        muscle_groups ( id, name )
      )
    `)
    .order('name')

  if (error) throw error

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all = (data || []).map((ex: any) => ({
    id: ex.id,
    name: ex.name,
    trackingType: ex.tracking_type || 'weight',
    isGlobal: ex.is_global,
    createdByUserId: ex.created_by_user_id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    muscleGroups: (ex.exercise_muscle_groups || []).map((emg: any) => emg.muscle_groups).filter(Boolean)
  }))

  // Show global exercises + exercises created by this user
  if (userId) {
    return all.filter(ex => ex.isGlobal || ex.createdByUserId === userId)
  }

  return all
}

export async function createCustomExercise(
  userId: string,
  name: string,
  muscleGroupIds: string[],
  trackingType: 'weight' | 'level' = 'weight'
) {
  // Check for duplicate name (global or by same user)
  const { data: existing } = await supabase
    .from('exercises')
    .select('id')
    .ilike('name', name.trim())
    .or(`is_global.eq.true,created_by_user_id.eq.${userId}`)
    .maybeSingle()

  if (existing) throw new Error('An exercise with this name already exists.')

  const { data: exercise, error: exErr } = await supabase
    .from('exercises')
    .insert({
      name: name.trim(),
      tracking_type: trackingType,
      is_global: false,
      created_by_user_id: userId
    })
    .select()
    .single()

  if (exErr) throw exErr

  if (muscleGroupIds.length > 0) {
    const inserts = muscleGroupIds.map(mgId => ({
      exercise_id: exercise.id,
      muscle_group_id: mgId
    }))
    const { error: mgErr } = await supabase.from('exercise_muscle_groups').insert(inserts)
    if (mgErr) throw mgErr
  }

  return exercise
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createWorkoutTemplate(userId: string, name: string, level: string, days: any[]) {
  // 1. Create template
  const { data: template, error: templateErr } = await supabase
    .from('workout_templates')
    .insert({ trainer_id: userId, name, level })
    .select()
    .single()
    
  if (templateErr) throw templateErr

  // 2. Create days and exercises
  for (let i = 0; i < days.length; i++) {
    const day = days[i]
    const { data: templateDay, error: dayErr } = await supabase
      .from('template_days')
      .insert({ template_id: template.id, day_sequence_number: i + 1 })
      .select()
      .single()
      
    if (dayErr) throw dayErr

    if (day.exercises.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exerciseInserts = day.exercises.map((ex: any, idx: number) => ({
        template_day_id: templateDay.id,
        exercise_id: ex.exerciseId,
        sets_data: ex.setsData,
        order_in_day: idx
      }))
      
      const { error: exErr } = await supabase.from('template_exercises').insert(exerciseInserts)
      if (exErr) throw exErr
    }
  }
  
  return template
}

export async function getWorkoutTemplateForEdit(templateId: string, userId: string) {
  const { data, error } = await supabase
    .from('workout_templates')
    .select(`
      id,
      name,
      level,
      trainer_id,
      template_days (
        id,
        day_sequence_number,
        template_exercises (
          id,
          exercise_id,
          sets_data,
          order_in_day
        )
      )
    `)
    .eq('id', templateId)
    .single()

  if (error) throw error
  if (!data) throw new Error('Template not found')

  if (data.trainer_id && data.trainer_id !== userId) {
    throw new Error('You are not allowed to edit this template')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizedDays = (data.template_days || []).sort((a: any, b: any) => a.day_sequence_number - b.day_sequence_number)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((day: any, dayIdx: number) => ({
      id: dayIdx + 1,
      exercises: (day.template_exercises || [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .sort((a: any, b: any) => a.order_in_day - b.order_in_day)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((ex: any) => ({
          exerciseId: ex.exercise_id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setsData: (ex.sets_data || []).map((set: any, idx: number) => ({
            setNumber: set?.setNumber ?? idx + 1,
            reps: Number(set?.reps ?? 10),
            weight: Number(set?.weight ?? 0)
          }))
        }))
    }))

  return {
    id: data.id,
    name: data.name,
    level: data.level,
    trainerId: data.trainer_id,
    isGlobal: !data.trainer_id,
    days: normalizedDays
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function updateWorkoutTemplate(userId: string, templateId: string, name: string, level: string, days: any[]) {
  const { data: existing, error: existingErr } = await supabase
    .from('workout_templates')
    .select('id, trainer_id')
    .eq('id', templateId)
    .single()

  if (existingErr) throw existingErr
  if (!existing?.trainer_id || existing.trainer_id !== userId) {
    throw new Error('You are not allowed to edit this template')
  }

  const { error: templateErr } = await supabase
    .from('workout_templates')
    .update({ name, level })
    .eq('id', templateId)

  if (templateErr) throw templateErr

  const { data: existingDays, error: daysFetchErr } = await supabase
    .from('template_days')
    .select('id')
    .eq('template_id', templateId)

  if (daysFetchErr) throw daysFetchErr

  if (existingDays && existingDays.length > 0) {
    const { error: deleteDaysErr } = await supabase
      .from('template_days')
      .delete()
      .eq('template_id', templateId)

    if (deleteDaysErr) throw deleteDaysErr
  }

  for (let i = 0; i < days.length; i++) {
    const day = days[i]
    const { data: templateDay, error: dayErr } = await supabase
      .from('template_days')
      .insert({ template_id: templateId, day_sequence_number: i + 1 })
      .select()
      .single()

    if (dayErr) throw dayErr

    if (day.exercises.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const exerciseInserts = day.exercises.map((ex: any, idx: number) => ({
        template_day_id: templateDay.id,
        exercise_id: ex.exerciseId,
        sets_data: ex.setsData,
        order_in_day: idx
      }))

      const { error: exErr } = await supabase.from('template_exercises').insert(exerciseInserts)
      if (exErr) throw exErr
    }
  }

  return { id: templateId }
}

export async function updateUserSchedule(
  userId: string,
  templateId: string,
  mapping: Record<string, string>,
  options?: { assignedByTrainerId?: string | null, recordHistory?: boolean }
) {
  const shouldRecordHistory = options?.recordHistory !== false
  const nowIso = new Date().toISOString()

  if (shouldRecordHistory) {
    const { error: closeErr } = await supabase
      .from('schedule_history')
      .update({ ended_at: nowIso })
      .eq('user_id', userId)
      .is('ended_at', null)

    if (closeErr) throw closeErr
  }

  await supabase.from('user_schedules').delete().eq('user_id', userId)
  
  const { data, error } = await supabase.from('user_schedules').insert({
    user_id: userId,
    template_id: templateId,
    day_of_week_mapping: mapping
  }).select().single()
  
  if (error) throw error

  if (shouldRecordHistory) {
    const { error: historyErr } = await supabase.from('schedule_history').insert({
      user_id: userId,
      template_id: templateId,
      day_of_week_mapping: mapping,
      assigned_by_trainer_id: options?.assignedByTrainerId || null,
      started_at: nowIso,
      ended_at: null
    })

    if (historyErr) throw historyErr
  }

  return data
}

export async function updateUserScheduleMapping(userId: string, mapping: Record<string, string>) {
  const { data: existing, error: existingErr } = await supabase
    .from('user_schedules')
    .select('id')
    .eq('user_id', userId)
    .single()

  if (existingErr) throw existingErr

  const { data, error } = await supabase
    .from('user_schedules')
    .update({ day_of_week_mapping: mapping })
    .eq('id', existing.id)
    .select()
    .single()

  if (error) throw error

  const { error: historyErr } = await supabase
    .from('schedule_history')
    .update({ day_of_week_mapping: mapping })
    .eq('user_id', userId)
    .is('ended_at', null)

  if (historyErr) throw historyErr

  return data
}

export async function getUserSchedule(userId: string) {
  const { data, error } = await supabase
    .from('user_schedules')
    .select(`
      *,
      workout_templates(
        name,
        level,
        template_days(
          id,
          day_sequence_number,
          template_exercises(
            id,
            exercise_id,
            sets_data,
            order_in_day,
            exercises(id, name, tracking_type)
          )
        )
      )
    `)
    .eq('user_id', userId)
    .single()
  
  if (error && error.code !== 'PGRST116') { // PGRST116 is no rows returned
    throw error
  }
  
  // Also fetch customizations if schedule exists
  if (data) {
    try {
      const { data: customizations } = await supabase
      .from('user_schedule_customizations')
      .select(`
        id,
        day_sequence_number,
        exercise_id,
        is_added,
        custom_tracking_type,
        initial_weight,
        order_in_day,
        exercises(id, name, tracking_type)
      `)
      .eq('user_id', userId)
      .eq('user_schedule_id', data.id)
      .order('day_sequence_number, order_in_day')

      // Attach customizations to the schedule data
      data.customizations = customizations || []
    } catch {
      // Customizations table may not exist yet - that's OK
      data.customizations = []
    }
  }
  
  return data
}

export async function getUserScheduleHistory(userId: string) {
  const { data, error } = await supabase
    .from('schedule_history')
    .select(`
      id,
      user_id,
      started_at,
      ended_at,
      workout_templates(name, level)
    `)
    .eq('user_id', userId)
    .order('started_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function deleteScheduleHistory(userId: string, historyId: string) {
  const { error } = await supabase
    .from('schedule_history')
    .delete()
    .eq('id', historyId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function reactivateFromHistory(userId: string, historyId: string) {
  // Load the history entry to get template_id and mapping
  const { data: hist, error: histErr } = await supabase
    .from('schedule_history')
    .select('template_id, day_of_week_mapping')
    .eq('id', historyId)
    .eq('user_id', userId)
    .single()

  if (histErr) throw histErr
  if (!hist) throw new Error('History entry not found')

  return updateUserSchedule(userId, hist.template_id, hist.day_of_week_mapping || {}, { recordHistory: true })
}

export async function getScheduleHistoryForUsers(userIds: string[]) {
  if (userIds.length === 0) return []

  const { data, error } = await supabase
    .from('schedule_history')
    .select(`
      id,
      user_id,
      started_at,
      ended_at,
      workout_templates(name, level)
    `)
    .in('user_id', userIds)
    .order('started_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getTrainers() {
  const { data, error } = await supabase.from('users').select('id, email, full_name, username').eq('role', 'trainer')
  if (error) throw error
  return data
}

export async function linkTrainer(userId: string, trainerId: string | null) {
  if (!trainerId) {
    const { data, error } = await supabase.from('trainer_clients').delete().eq('client_id', userId)
    if (error) throw error
    return data
  }
  
  await supabase.from('trainer_clients').delete().eq('client_id', userId)
  const { data, error } = await supabase.from('trainer_clients').insert({
    client_id: userId,
    trainer_id: trainerId,
    status: 'pending'
  })
  if (error) throw error
  return data
}

export async function getTrainerClients(trainerId: string) {
  const { data, error } = await supabase
    .from('trainer_clients')
    .select(`
      created_at,
      client:users!client_id(
        id, email, full_name, username,
        user_schedules (
          workout_templates ( name )
        )
      )
    `)
    .eq('trainer_id', trainerId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
  
  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((d: any) => ({
    ...d.client,
    linked_at: d.created_at
  }))
}

export async function getTrainerTemplates(trainerId: string) {
  const { data, error } = await supabase
    .from('workout_templates')
    .select('*')
    .or(`trainer_id.eq.${trainerId},trainer_id.is.null`)
    .order('name')
    
  if (error) throw error
  return data
}

export async function deleteTrainerTemplate(trainerId: string, templateId: string) {
  const { data: existing, error: existingErr } = await supabase
    .from('workout_templates')
    .select('id, trainer_id')
    .eq('id', templateId)
    .single()

  if (existingErr) throw existingErr
  if (!existing?.trainer_id || existing.trainer_id !== trainerId) {
    throw new Error('You are not allowed to delete this template')
  }

  // Get all template days first
  const { data: days } = await supabase
    .from('template_days')
    .select('id')
    .eq('template_id', templateId)

  if (days && days.length > 0) {
    const dayIds = days.map((d: { id: string }) => d.id)
    // Delete exercises first (FK: template_day_id -> template_days)
    const { error: exErr } = await supabase
      .from('template_exercises')
      .delete()
      .in('template_day_id', dayIds)
    if (exErr) throw exErr

    // Delete days (FK: template_id -> workout_templates)
    const { error: daysErr } = await supabase
      .from('template_days')
      .delete()
      .eq('template_id', templateId)
    if (daysErr) throw daysErr
  }

  const { error } = await supabase
    .from('workout_templates')
    .delete()
    .eq('id', templateId)

  if (error) throw error
}

export async function updateClientStatus(trainerId: string, clientId: string, status: 'approved' | 'rejected') {
  if (status === 'rejected') {
    const { data, error } = await supabase
      .from('trainer_clients')
      .delete()
      .eq('trainer_id', trainerId)
      .eq('client_id', clientId)

    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('trainer_clients')
    .update({ status })
    .eq('trainer_id', trainerId)
    .eq('client_id', clientId)
    
  if (error) throw error
  return data
}

export async function getPendingClients(trainerId: string) {
  const { data, error } = await supabase
    .from('trainer_clients')
    .select(`
      client:users!client_id(
        id, email, full_name, username
      )
    `)
    .eq('trainer_id', trainerId)
    .eq('status', 'pending')
    
  if (error) throw error
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((d: any) => d.client)
}

export async function findAthleteByUsername(username: string) {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, full_name, username')
    .eq('role', 'athlete')
    .ilike('username', username.trim())
    .maybeSingle()

  if (error) throw error
  return data
}

export async function sendTrainerRequest(trainerId: string, clientId: string) {
  // Check if a relationship already exists
  const { data: existing } = await supabase
    .from('trainer_clients')
    .select('id, status')
    .eq('trainer_id', trainerId)
    .eq('client_id', clientId)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'approved') throw new Error('This athlete is already your client.')
    if (existing.status === 'pending') throw new Error('A request is already pending for this athlete.')
  }

  const { error } = await supabase.from('trainer_clients').insert({
    trainer_id: trainerId,
    client_id: clientId,
    status: 'pending'
  })

  if (error) throw error
}

export async function getPendingTrainerRequests(clientId: string) {
  const { data, error } = await supabase
    .from('trainer_clients')
    .select(`
      trainer_id,
      created_at,
      trainer:users!trainer_id(
        id,
        email,
        full_name,
        username
      )
    `)
    .eq('client_id', clientId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function removeTrainerClient(trainerId: string, clientId: string) {
  const { error } = await supabase
    .from('trainer_clients')
    .delete()
    .eq('trainer_id', trainerId)
    .eq('client_id', clientId)

  if (error) throw error
}

export async function respondToTrainerRequest(clientId: string, trainerId: string, decision: 'approved' | 'denied') {
  if (decision === 'denied') {
    const { error } = await supabase
      .from('trainer_clients')
      .delete()
      .eq('client_id', clientId)
      .eq('trainer_id', trainerId)
      .eq('status', 'pending')

    if (error) throw error
    return
  }

  const { error } = await supabase
    .from('trainer_clients')
    .update({ status: 'approved' })
    .eq('client_id', clientId)
    .eq('trainer_id', trainerId)
    .eq('status', 'pending')

  if (error) throw error
}

// User Schedule Customizations API

export async function getScheduleCustomizations(userId: string, userScheduleId: string) {
  const { data, error } = await supabase
    .from('user_schedule_customizations')
    .select(`
      id,
      day_sequence_number,
      exercise_id,
      is_added,
      custom_tracking_type,
      initial_weight,
      order_in_day,
      exercises(id, name, tracking_type)
    `)
    .eq('user_id', userId)
    .eq('user_schedule_id', userScheduleId)
    .order('day_sequence_number, order_in_day')

  if (error) throw error
  return data || []
}

export async function addCustomExerciseToSchedule(
  userId: string,
  userScheduleId: string,
  daySequenceNumber: number,
  exerciseId: string,
  trackingType?: 'weight' | 'level',
  initialWeight?: number
) {
  // Get the max order_in_day for this day to insert at the end
  const { data: customizations, error: queryError } = await supabase
    .from('user_schedule_customizations')
    .select('order_in_day')
    .eq('user_id', userId)
    .eq('user_schedule_id', userScheduleId)
    .eq('day_sequence_number', daySequenceNumber)
    .order('order_in_day', { ascending: false })
    .limit(1)

  if (queryError) throw queryError

  const maxOrder = customizations && customizations.length > 0 ? customizations[0].order_in_day : 0
  const newOrder = maxOrder + 1

  const { data, error } = await supabase
    .from('user_schedule_customizations')
    .insert({
      user_id: userId,
      user_schedule_id: userScheduleId,
      day_sequence_number: daySequenceNumber,
      exercise_id: exerciseId,
      is_added: true,
      custom_tracking_type: trackingType || null,
      initial_weight: initialWeight ?? null,
      order_in_day: newOrder
    })
    .select()

  if (error) throw error
  return data?.[0]
}

export async function upsertScheduleExerciseCustomization(
  userId: string,
  userScheduleId: string,
  daySequenceNumber: number,
  exerciseId: string,
  orderInDay: number,
  updates: { trackingType?: 'weight' | 'level' | null, initialWeight?: number | null }
) {
  const { data: existing, error: existingError } = await supabase
    .from('user_schedule_customizations')
    .select('id')
    .eq('user_id', userId)
    .eq('user_schedule_id', userScheduleId)
    .eq('day_sequence_number', daySequenceNumber)
    .eq('exercise_id', exerciseId)
    .eq('is_added', false)
    .limit(1)

  if (existingError) throw existingError

  if (existing && existing.length > 0) {
    const payload: { custom_tracking_type?: 'weight' | 'level' | null, initial_weight?: number | null } = {}
    if (Object.prototype.hasOwnProperty.call(updates, 'trackingType')) payload.custom_tracking_type = updates.trackingType ?? null
    if (Object.prototype.hasOwnProperty.call(updates, 'initialWeight')) payload.initial_weight = updates.initialWeight ?? null
    const payloadWithOrder = {
      ...payload,
      order_in_day: orderInDay
    }

    const { data, error } = await supabase
      .from('user_schedule_customizations')
      .update(payloadWithOrder)
      .eq('id', existing[0].id)
      .select()

    if (error) throw error
    return data?.[0]
  }

  const insertPayload = {
    user_id: userId,
    user_schedule_id: userScheduleId,
    day_sequence_number: daySequenceNumber,
    exercise_id: exerciseId,
    is_added: false,
    custom_tracking_type: Object.prototype.hasOwnProperty.call(updates, 'trackingType') ? (updates.trackingType ?? null) : null,
    initial_weight: Object.prototype.hasOwnProperty.call(updates, 'initialWeight') ? (updates.initialWeight ?? null) : null,
    order_in_day: orderInDay
  }

  const { data, error } = await supabase
    .from('user_schedule_customizations')
    .insert(insertPayload)
    .select()

  if (error) throw error
  return data?.[0]
}

export async function updateCustomizationTrackingType(
  customizationId: string,
  trackingType: 'weight' | 'level' | null
) {
  const { data, error } = await supabase
    .from('user_schedule_customizations')
    .update({
      custom_tracking_type: trackingType
    })
    .eq('id', customizationId)
    .select()

  if (error) throw error
  return data?.[0]
}

export async function updateCustomizationInitialWeight(
  customizationId: string,
  initialWeight: number | null
) {
  const { data, error } = await supabase
    .from('user_schedule_customizations')
    .update({
      initial_weight: initialWeight
    })
    .eq('id', customizationId)
    .select()

  if (error) throw error
  return data?.[0]
}

export async function updateCustomizationOrder(
  customizationId: string,
  orderInDay: number
) {
  const { data, error } = await supabase
    .from('user_schedule_customizations')
    .update({
      order_in_day: orderInDay
    })
    .eq('id', customizationId)
    .select()

  if (error) throw error
  return data?.[0]
}

export async function deleteCustomization(customizationId: string) {
  const { error } = await supabase
    .from('user_schedule_customizations')
    .delete()
    .eq('id', customizationId)

  if (error) throw error
}

export async function deleteAllCustomizations(userId: string, userScheduleId: string) {
  const { error } = await supabase
    .from('user_schedule_customizations')
    .delete()
    .eq('user_id', userId)
    .eq('user_schedule_id', userScheduleId)

  if (error) throw error
}

export async function saveScheduleDayCustomizations(
  userId: string,
  userScheduleId: string,
  daySequenceNumber: number,
  rows: Array<{
    exerciseId: string
    isAdded: boolean
    trackingType: 'weight' | 'level' | null
    initialWeight: number | null
    orderInDay: number
  }>
) {
  const { error: deleteError } = await supabase
    .from('user_schedule_customizations')
    .delete()
    .eq('user_id', userId)
    .eq('user_schedule_id', userScheduleId)
    .eq('day_sequence_number', daySequenceNumber)

  if (deleteError) throw deleteError

  if (!rows.length) return []

  const payload = rows.map(row => ({
    user_id: userId,
    user_schedule_id: userScheduleId,
    day_sequence_number: daySequenceNumber,
    exercise_id: row.exerciseId,
    is_added: row.isAdded,
    custom_tracking_type: row.trackingType,
    initial_weight: row.initialWeight,
    order_in_day: row.orderInDay
  }))

  const { data, error } = await supabase
    .from('user_schedule_customizations')
    .insert(payload)
    .select()

  if (error) throw error
  return data || []
}

