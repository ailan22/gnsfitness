import type { Exercise, SessionExerciseResult } from './data'

export type CloudPlan = {
  exercisesByDay?: Record<string, Exercise[]>
  blockExercises?: Record<string, Record<string, Exercise[]>>
  weekExercises?: Record<string, Record<string, Record<string, Exercise[]>>>
  blockDetails?: Record<string, { name: string; warmup: string; objective: string }>
  sessionGuidance?: Record<string, Record<string, Record<string, string>>>
  sessionComponents?: Record<string, Record<string, Record<string, { id: string; title: string; details: string }[]>>>
}
export type CloudRoutine = { id: string; name: string; goal: string; level: string; days_per_week: number; program_rounds: number; block_rounds: number; plan: CloudPlan }
export type CloudSession = { id: string; performed_at: string; routine_id: string | null; routine_name: string; day: number | null; block: number | null; week: number | null; notes: string; results: SessionExerciseResult[]; created_at: string }

export function plannedExercises(plan: CloudPlan, day: number, block: number, week: number, blockRounds: number, programRounds: number): Exercise[] {
  for (let previous = week; previous > 1; previous--) {
    const items = plan.weekExercises?.[block]?.[previous]?.[day]
    if (items) return items
  }
  if (block > 1) {
    const items = plan.blockExercises?.[block]?.[day]
    if (items) return items
    const previousWeek = Math.min(blockRounds, programRounds - (block - 2) * blockRounds)
    return plannedExercises(plan, day, block - 1, previousWeek, blockRounds, programRounds)
  }
  return plan.exercisesByDay?.[day] ?? []
}

export function plannedGuidance(plan: CloudPlan, day: number, block: number, week: number, blockRounds: number, programRounds: number): string {
  for (let previous = week; previous >= 1; previous--) {
    const note = plan.sessionGuidance?.[block]?.[previous]?.[day]
    if (note !== undefined) return note
  }
  return block > 1 ? plannedGuidance(plan, day, block - 1,
    Math.min(blockRounds, programRounds - (block - 2) * blockRounds), blockRounds, programRounds) : ''
}

export function plannedComponents(plan: CloudPlan, day: number, block: number, week: number, blockRounds: number, programRounds: number): { id: string; title: string; details: string }[] {
  for (let previous = week; previous >= 1; previous--) {
    const items = plan.sessionComponents?.[block]?.[previous]?.[day]
    if (items) return items
  }
  return block > 1 ? plannedComponents(plan, day, block - 1,
    Math.min(blockRounds, programRounds - (block - 2) * blockRounds), blockRounds, programRounds) : []
}

export function trainingProgress(routine: CloudRoutine, routines: CloudRoutine[], sessions: CloudSession[], currentDate: string) {
  const uniqueName = routines.filter(item => item.name === routine.name).length === 1
  const matching = sessions.filter(item => item.day !== null && item.performed_at <= currentDate &&
    (item.routine_id === routine.id || (!item.routine_id && uniqueName && item.routine_name === routine.name)))
    .sort((a, b) => a.performed_at.localeCompare(b.performed_at) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
  let completed = 0; let expected = 1
  for (const item of matching) {
    if (item.day === expected) {
      if (expected === routine.days_per_week) { completed++; expected = 1 }
      else expected++
    } else if (item.day === 1) expected = routine.days_per_week === 1 ? 1 : 2
  }
  const last = matching.at(-1)
  const nextDay = ((last?.day || 0) % routine.days_per_week) + 1
  const finished = completed >= routine.program_rounds
  const block = Math.min(Math.floor(completed / routine.block_rounds) + 1, Math.ceil(routine.program_rounds / routine.block_rounds))
  const week = Math.min(Math.max(1, completed - (block - 1) * routine.block_rounds + 1), routine.program_rounds - (block - 1) * routine.block_rounds)
  return { nextDay, completed, finished, block, week, last }
}

// Exact exercise identity avoids suggesting loads from a different movement or routine.
export function lastExerciseResult(sessions: CloudSession[], routineId: string, exercise: Exercise, currentDate: string) {
  const matching = sessions.filter(session => session.routine_id === routineId && session.performed_at <= currentDate)
    .sort((a,b) => b.performed_at.localeCompare(a.performed_at) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
  for (const session of matching) {
    const result = session.results?.find(result => result.exerciseId === exercise.id && result.name.trim().toLowerCase() === exercise.name.trim().toLowerCase() && [result.sets, result.reps, result.load, result.rir].some(value => value?.trim()))
    if (result) return { result, date: session.performed_at }
  }
  return null
}
