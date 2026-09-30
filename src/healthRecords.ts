export type HealthKind = 'training_intake' | 'physio_assessment' | 'physio_followup'
export type HealthField = { key: string; label: string; group: string; required?: boolean; options?: string[]; type?: 'text' | 'pain' | 'date'; hint?: string }
export const healthTitles: Record<HealthKind, string> = { training_intake: 'Anamnesis inicial de salud y entrenamiento', physio_assessment: 'Evaluación de kinesiología', physio_followup: 'Evolución de kinesiología' }
const consent: HealthField = { key: 'consent', label: 'Consentimiento informado', group: 'Acuerdos y plan', required: true, options: ['Verbal registrado', 'Escrito registrado', 'Pendiente / no otorgado'], hint: 'Registrá lo conversado y la autorización real. Este campo no reemplaza el documento de consentimiento.' }
export const healthFields: Record<HealthKind, HealthField[]> = {
  training_intake: [
    { key: 'goals', label: 'Objetivo y prioridades de la persona', group: 'Punto de partida', required: true },
    { key: 'activity', label: 'Actividad actual y experiencia', group: 'Punto de partida', required: true, hint: 'Tipo de actividad, frecuencia, duración e intensidad habitual.' },
    { key: 'availability', label: 'Disponibilidad y preferencias', group: 'Punto de partida', hint: 'Días, tiempo por sesión y actividades que disfruta.' },
    { key: 'history', label: 'Antecedentes de salud relevantes', group: 'Salud y cuidados', hint: 'Condiciones conocidas que afecten el ejercicio. Si se desconoce, indicarlo.' },
    { key: 'medication', label: 'Medicación y alergias relevantes', group: 'Salud y cuidados' },
    { key: 'injuries', label: 'Lesiones, cirugías, dolor o limitaciones', group: 'Salud y cuidados' },
    { key: 'symptoms', label: 'Síntomas asociados al esfuerzo', group: 'Salud y cuidados', required: true, options: ['Sin síntomas referidos', 'Síntomas referidos', 'Pendiente de revisión'], hint: 'Preguntar por dolor torácico, desmayo, falta de aire inusual u otros síntomas. No determina aptitud automáticamente.' },
    { key: 'symptom_details', label: 'Detalle de síntomas y acciones tomadas', group: 'Salud y cuidados' },
    { key: 'guidance', label: 'Indicaciones o restricciones del profesional de salud', group: 'Salud y cuidados', hint: 'Anotá fuente y fecha si existen; no pedir certificados sin motivo.' },
    { key: 'context', label: 'Descanso y exigencias cotidianas relevantes', group: 'Punto de partida', hint: 'Solo lo que ayude a adaptar el entrenamiento.' },
    consent,
    { key: 'consent_notes', label: 'Alcance acordado y observaciones del consentimiento', group: 'Acuerdos y plan' },
    { key: 'decision', label: 'Próximo paso acordado', group: 'Acuerdos y plan', required: true, options: ['Pendiente de valoración', 'Plan adaptado acordado', 'Consulta de salud antes de avanzar'] },
    { key: 'plan', label: 'Cuidados, plan inicial y seguimiento', group: 'Acuerdos y plan', required: true },
  ],
  physio_assessment: [
    { key: 'reason', label: 'Motivo de consulta y objetivo de la persona', group: 'Consulta', required: true },
    { key: 'region', label: 'Región y lateralidad', group: 'Consulta', required: true, type: 'text' },
    { key: 'onset', label: 'Inicio, mecanismo y evolución', group: 'Consulta', required: true },
    { key: 'pain_rest', label: 'Dolor en reposo · 0 a 10', group: 'Consulta', type: 'pain' },
    { key: 'pain_movement', label: 'Dolor con movimiento · 0 a 10', group: 'Consulta', type: 'pain' },
    { key: 'factors', label: 'Qué agrava o alivia los síntomas', group: 'Consulta' },
    { key: 'function', label: 'Actividades limitadas e impacto cotidiano', group: 'Consulta', required: true },
    { key: 'history', label: 'Antecedentes, cirugías y tratamientos relevantes', group: 'Antecedentes y evaluación' },
    { key: 'medication', label: 'Medicación y alergias relevantes', group: 'Antecedentes y evaluación' },
    { key: 'referral', label: 'Derivación, diagnóstico médico o estudios disponibles', group: 'Antecedentes y evaluación', hint: 'Identificá fuente y fecha. No confundir un diagnóstico referido con la valoración propia.' },
    { key: 'alerts', label: 'Señales de alarma y necesidad de derivación', group: 'Antecedentes y evaluación', required: true, options: ['No identificadas en esta evaluación', 'Requiere derivación', 'Evaluación pendiente'] },
    { key: 'alert_details', label: 'Hallazgos de alarma y conducta adoptada', group: 'Antecedentes y evaluación' },
    { key: 'examination', label: 'Exploración y medidas objetivas', group: 'Antecedentes y evaluación', required: true, hint: 'Movilidad, fuerza, sensibilidad y pruebas pertinentes. Indicá lado, unidades y herramienta utilizada.' },
    { key: 'assessment', label: 'Valoración funcional del profesional', group: 'Antecedentes y evaluación', required: true },
    { key: 'goals', label: 'Objetivos medibles y plazo de revisión', group: 'Acuerdos y plan', required: true },
    consent,
    { key: 'consent_notes', label: 'Alcance, riesgos explicados y acuerdos', group: 'Acuerdos y plan' },
    { key: 'plan', label: 'Plan de atención y precauciones', group: 'Acuerdos y plan', required: true, hint: 'Intervenciones previstas, frecuencia orientativa e indicaciones domiciliarias cuando correspondan.' },
    { key: 'review_date', label: 'Fecha prevista de reevaluación', group: 'Acuerdos y plan', type: 'date' },
  ],
  physio_followup: [
    { key: 'subjective', label: 'Evolución referida por la persona', group: 'Evolución de la sesión', required: true },
    { key: 'pain_rest', label: 'Dolor en reposo · 0 a 10', group: 'Evolución de la sesión', type: 'pain' },
    { key: 'pain_movement', label: 'Dolor con movimiento · 0 a 10', group: 'Evolución de la sesión', type: 'pain' },
    { key: 'objective', label: 'Hallazgos y medidas de seguimiento', group: 'Evolución de la sesión', required: true },
    { key: 'intervention', label: 'Intervención realizada y dosificación', group: 'Evolución de la sesión', required: true },
    { key: 'response', label: 'Respuesta, tolerancia e incidencias', group: 'Evolución de la sesión', required: true },
    { key: 'status', label: 'Situación al finalizar la sesión', group: 'Seguimiento', required: true, options: ['En tratamiento', 'Reevaluación', 'Alta', 'Derivación', 'Pausa'] },
    { key: 'plan', label: 'Indicaciones, próximos pasos o motivo de alta/derivación', group: 'Seguimiento', required: true },
    { key: 'consent_notes', label: 'Cambios en el consentimiento o los acuerdos', group: 'Seguimiento' },
    { key: 'review_date', label: 'Próxima revisión prevista', group: 'Seguimiento', type: 'date' },
  ],
}
export function todayHealth() { return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10) }
export function validHealthDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value }
export function validateHealth(kind: HealthKind, values: Record<string, string>): string | null {
  for (const field of healthFields[kind]) {
    const value = values[field.key]?.trim() ?? ''
    if (field.required && !value) return `Completá «${field.label}».`
    if (value.length > 2000) return `«${field.label}» supera los 2000 caracteres.`
    if (value && field.options && !field.options.includes(value)) return `Revisá «${field.label}».`
    if (value && field.type === 'pain' && !/^(?:[0-9]|10)$/.test(value)) return 'El dolor debe ser un número entero de 0 a 10, o quedar sin registrar.'
    if (value && field.type === 'date' && !validHealthDate(value)) return 'Revisá la fecha de reevaluación.'
  }
  if (kind === 'training_intake' && values.symptoms === 'Síntomas referidos' && !values.symptom_details?.trim()) return 'Detallá los síntomas y las acciones tomadas.'
  if (kind === 'physio_assessment' && values.alerts === 'Requiere derivación' && !values.alert_details?.trim()) return 'Detallá los hallazgos y la conducta de derivación.'
  return null
}
export type HealthRecord = { id: string; member_id: string; kind: HealthKind; occurred_on: string; professional: string; registration: string; payload: Record<string, string>; episode_id: string | null; correction_of: string | null; correction_reason: string; created_at: string }
export function sameHealthContent(saved: Record<string, unknown>, candidate: Record<string, unknown>) {
  const keys = ['member_id', 'kind', 'occurred_on', 'professional', 'registration', 'episode_id', 'correction_of', 'correction_reason']
  if (keys.some(key => (saved[key] ?? '') !== (candidate[key] ?? ''))) return false
  const a = saved.payload as Record<string, string>, b = candidate.payload as Record<string, string>
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].every(key => (a[key] ?? '') === (b[key] ?? ''))
}

export type HealthDraft = { occurred_on: string; professional: string; registration: string; payload: Record<string, string> }
export const blankHealthDraft = (): HealthDraft => ({ occurred_on: todayHealth(), professional: '', registration: '', payload: {} })
export function validateHealthDraft(kind: HealthKind, draft: HealthDraft) {
  if (!validHealthDate(draft.occurred_on) || draft.occurred_on > todayHealth() || draft.occurred_on < '1900-01-01') return 'Revisá la fecha de atención.'
  if (!draft.professional.trim() || draft.professional.trim().length > 160) return 'Indicá el profesional responsable.'
  return validateHealth(kind, draft.payload)
}
