type Choice = { options: string[]; multiple?: boolean; detailFor?: string[] }
export const intakeChoices: Record<string, Choice> = {
  goals: { options: ['Mejorar fuerza', 'Mejorar resistencia', 'Mejorar movilidad', 'Mejorar composición corporal', 'Bienestar general', 'Otro objetivo'], multiple: true, detailFor: ['Otro objetivo'] },
  activity: { options: ['Sin actividad habitual', 'Actividad ocasional', 'Entrena regularmente', 'Retoma después de una pausa', 'Pendiente de consultar'] },
  availability: { options: ['2 días por semana', '3 días por semana', '5 días por semana', 'Por definir'] },
  history: { options: ['No refiere antecedentes relevantes', 'Refiere antecedentes relevantes', 'Pendiente de consultar'], detailFor: ['Refiere antecedentes relevantes'] },
  medication: { options: ['No refiere medicación ni alergias relevantes', 'Refiere medicación o alergias relevantes', 'Pendiente de consultar'], detailFor: ['Refiere medicación o alergias relevantes'] },
  injuries: { options: ['No refiere lesiones ni limitaciones', 'Refiere lesiones, cirugías, dolor o limitaciones', 'Pendiente de consultar'], detailFor: ['Refiere lesiones, cirugías, dolor o limitaciones'] },
  guidance: { options: ['No refiere indicaciones o restricciones', 'Tiene indicaciones o restricciones', 'Pendiente de consultar'], detailFor: ['Tiene indicaciones o restricciones'] },
  context: { options: ['No refiere dificultades relevantes', 'Descanso o exigencias cotidianas afectan el entrenamiento', 'Pendiente de consultar'], detailFor: ['Descanso o exigencias cotidianas afectan el entrenamiento'] },
  plan: { options: ['Definir plan en la próxima entrevista', 'Plan adaptado con seguimiento', 'Esperar consulta de salud antes de avanzar'], detailFor: ['Plan adaptado con seguimiento'] },
}
