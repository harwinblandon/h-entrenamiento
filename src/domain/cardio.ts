/**
 * Modalidades de cardio con su MET aproximado (Compendio de Actividades Físicas, 2011).
 * El MET depende mucho de la intensidad; estos valores corresponden a un esfuerzo moderado.
 */
export const CARDIO_MODALITIES: { id: string; label: string; met: number }[] = [
  { id: 'walk', label: 'Caminar', met: 3.5 },
  { id: 'incline_walk', label: 'Caminar en inclinación', met: 6 },
  { id: 'jump_rope', label: 'Saltar cuerda', met: 10 },
  { id: 'stair', label: 'Escaladora', met: 9 },
  { id: 'bike', label: 'Bicicleta', met: 6.8 },
  { id: 'elliptical', label: 'Elíptica', met: 5 },
  { id: 'run', label: 'Trotar / correr', met: 8 },
  { id: 'row', label: 'Remo', met: 7 },
  { id: 'swim', label: 'Natación', met: 6 },
  { id: 'intervals', label: 'Intervalos / cambios de ritmo', met: 8 },
  { id: 'sport', label: 'Deporte recreativo', met: 7 },
]

export interface CardioEstimate {
  /** Gasto neto promedio por día (por encima del reposo), kcal. */
  kcalPerDay: number
  kcalPerSession: number
  met: number
}

/** Gasto neto: (MET − 1) × kg × horas, promediado entre las modalidades elegidas y repartido en 7 días. */
export function estimateCardio(
  cardio: { modalities: string[]; daysPerWeek: number; minutes: number },
  weightKg: number,
): CardioEstimate {
  const mets = CARDIO_MODALITIES.filter((m) => cardio.modalities.includes(m.id)).map((m) => m.met)
  if (mets.length === 0 || cardio.daysPerWeek <= 0 || cardio.minutes <= 0) return { kcalPerDay: 0, kcalPerSession: 0, met: 0 }
  const met = mets.reduce((a, b) => a + b, 0) / mets.length
  const kcalPerSession = (met - 1) * weightKg * (cardio.minutes / 60)
  return {
    kcalPerDay: Math.round((kcalPerSession * cardio.daysPerWeek) / 7),
    kcalPerSession: Math.round(kcalPerSession),
    met: Math.round(met * 10) / 10,
  }
}
