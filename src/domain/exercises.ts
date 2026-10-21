import type { Equipment, EquipmentProfile, Exercise, ExerciseCategory } from './types'

export const EXERCISES: Exercise[] = [
  // Pecho
  {
    id: 'bench_press', name: 'Press de banca con barra', primary: ['chest'], secondary: ['triceps', 'delts_front'],
    category: 'compound', pattern: 'horizontal_press', equipment: 'barbell', increment: 2.5, failureSafe: false, fatigue: 3,
    cues: ['Escápulas retraídas y pies firmes', 'Barra a la parte baja del pecho', 'Codos a ~45–70° del torso'],
  },
  {
    id: 'incline_db_press', name: 'Press inclinado con mancuernas', primary: ['chest'], secondary: ['triceps', 'delts_front'],
    category: 'compound', pattern: 'incline_press', equipment: 'dumbbell', increment: 2, failureSafe: false, fatigue: 2,
    repRange: [8, 12], loadNote: 'kg por mancuerna',
    cues: ['Banco a 30–45°', 'Bajar hasta sentir estiramiento en el pecho', 'Antebrazos verticales'],
  },
  {
    id: 'incline_bench_press', name: 'Press inclinado con barra', primary: ['chest'], secondary: ['triceps', 'delts_front'],
    category: 'compound', pattern: 'incline_press', equipment: 'barbell', increment: 2.5, failureSafe: false, fatigue: 2,
    cues: ['Banco a 30°', 'Barra a la parte alta del pecho', 'Mantener escápulas retraídas'],
  },
  {
    id: 'db_bench_press', name: 'Press plano con mancuernas', primary: ['chest'], secondary: ['triceps', 'delts_front'],
    category: 'compound', pattern: 'horizontal_press', equipment: 'dumbbell', increment: 2, failureSafe: false, fatigue: 2,
    repRange: [8, 12], loadNote: 'kg por mancuerna',
    cues: ['Rango completo con control', 'No chocar las mancuernas arriba'],
  },
  {
    id: 'machine_chest_press', name: 'Press de pecho en máquina', primary: ['chest'], secondary: ['triceps', 'delts_front'],
    category: 'machine', pattern: 'horizontal_press', equipment: 'machine', increment: 5, failureSafe: true, fatigue: 1,
    cues: ['Ajustar asiento: agarres a la altura media del pecho', 'Pausa breve en el estiramiento'],
  },
  {
    id: 'cable_fly', name: 'Aperturas en polea', primary: ['chest'], secondary: [],
    category: 'isolation', pattern: 'chest_fly', equipment: 'cable', increment: 2.5, failureSafe: true, fatigue: 1,
    cues: ['Codos ligeramente flexionados y fijos', 'Abrazar un árbol, sin convertirlo en press'],
  },
  {
    id: 'pec_deck', name: 'Aperturas en máquina (pec deck)', primary: ['chest'], secondary: [],
    category: 'isolation', pattern: 'chest_fly', equipment: 'machine', increment: 5, failureSafe: true, fatigue: 1,
    cues: ['Pecho alto', 'Controlar la fase excéntrica'],
  },
  {
    id: 'dips', name: 'Fondos en paralelas', primary: ['chest'], secondary: ['triceps', 'delts_front'],
    category: 'compound', pattern: 'dip', equipment: 'bodyweight', increment: 2.5, failureSafe: false, fatigue: 2,
    repRange: [6, 12], loadNote: 'lastre en kg (0 = peso corporal)',
    cues: ['Inclinar el torso hacia delante', 'Bajar solo hasta donde el hombro lo tolere'],
  },
  {
    id: 'push_up', name: 'Flexiones', primary: ['chest'], secondary: ['triceps', 'delts_front'],
    category: 'compound', pattern: 'horizontal_press', equipment: 'bodyweight', increment: 0, failureSafe: true, fatigue: 1,
    repRange: [8, 20], loadNote: 'lastre en kg (0 = peso corporal)',
    cues: ['Cuerpo alineado', 'Pecho cerca del suelo en cada repetición'],
  },

  // Espalda
  {
    id: 'pull_up', name: 'Dominadas', primary: ['back'], secondary: ['biceps'],
    category: 'compound', pattern: 'vertical_pull', equipment: 'bodyweight', increment: 2.5, failureSafe: true, fatigue: 2,
    loadNote: 'lastre en kg (0 = peso corporal)',
    cues: ['Partir desde brazos extendidos', 'Llevar el pecho hacia la barra'],
  },
  {
    id: 'lat_pulldown', name: 'Jalón al pecho', primary: ['back'], secondary: ['biceps'],
    category: 'machine', pattern: 'vertical_pull', equipment: 'cable', increment: 5, failureSafe: true, fatigue: 1,
    repRange: [8, 12],
    cues: ['Llevar los codos hacia las costillas', 'Evitar balanceo del torso'],
  },
  {
    id: 'barbell_row', name: 'Remo con barra', primary: ['back'], secondary: ['biceps', 'delts_rear', 'traps'],
    category: 'compound', pattern: 'horizontal_pull', equipment: 'barbell', increment: 2.5, failureSafe: false, fatigue: 3,
    cues: ['Torso estable a ~45°', 'Tirar hacia el ombligo sin impulso'],
  },
  {
    id: 'chest_supported_row', name: 'Remo con pecho apoyado', primary: ['back'], secondary: ['biceps', 'delts_rear', 'traps'],
    category: 'machine', pattern: 'horizontal_pull', equipment: 'machine', increment: 5, failureSafe: true, fatigue: 1,
    repRange: [8, 12],
    cues: ['Pecho pegado al soporte', 'Estirar completamente adelante'],
  },
  {
    id: 'seated_cable_row', name: 'Remo sentado en polea', primary: ['back'], secondary: ['biceps', 'delts_rear'],
    category: 'machine', pattern: 'horizontal_pull', equipment: 'cable', increment: 5, failureSafe: true, fatigue: 1,
    repRange: [8, 12],
    cues: ['Torso quieto', 'Codos atrás y escápulas juntas al final'],
  },
  {
    id: 'db_row', name: 'Remo con mancuerna a una mano', primary: ['back'], secondary: ['biceps', 'delts_rear'],
    category: 'compound', pattern: 'horizontal_pull', equipment: 'dumbbell', increment: 2, failureSafe: true, fatigue: 1,
    repRange: [8, 12], loadNote: 'kg por mancuerna',
    cues: ['Apoyo estable en el banco', 'Llevar la mancuerna hacia la cadera'],
  },
  {
    id: 'straight_arm_pulldown', name: 'Pullover en polea', primary: ['back'], secondary: [],
    category: 'isolation', pattern: 'shoulder_extension', equipment: 'cable', increment: 2.5, failureSafe: true, fatigue: 1,
    repRange: [10, 15],
    cues: ['Brazos casi extendidos', 'Movimiento desde el hombro'],
  },

  // Trapecio
  {
    id: 'db_shrug', name: 'Encogimientos con mancuernas', primary: ['traps'], secondary: [],
    category: 'isolation', pattern: 'shrug', equipment: 'dumbbell', increment: 2, failureSafe: true, fatigue: 1,
    repRange: [10, 15], loadNote: 'kg por mancuerna',
    cues: ['Subir hombros hacia las orejas', 'Pausa de 1 s arriba, sin rotar'],
  },
  {
    id: 'barbell_shrug', name: 'Encogimientos con barra', primary: ['traps'], secondary: [],
    category: 'isolation', pattern: 'shrug', equipment: 'barbell', increment: 2.5, failureSafe: true, fatigue: 1,
    repRange: [10, 15],
    cues: ['Brazos relajados como ganchos', 'Pausa arriba'],
  },
  {
    id: 'smith_shrug', name: 'Encogimientos en máquina Smith', primary: ['traps'], secondary: [],
    category: 'isolation', pattern: 'shrug', equipment: 'smith', increment: 2.5, failureSafe: true, fatigue: 1,
    repRange: [10, 15],
    cues: ['Recorrido completo', 'Pausa arriba'],
  },

  // Hombros
  {
    id: 'ohp', name: 'Press militar con barra', primary: ['delts_front'], secondary: ['triceps', 'delts_side'],
    category: 'compound', pattern: 'vertical_press', equipment: 'barbell', increment: 2.5, failureSafe: false, fatigue: 2,
    cues: ['Glúteos y abdomen firmes', 'Cabeza atrás para pasar la barra'],
  },
  {
    id: 'db_shoulder_press', name: 'Press de hombro con mancuernas', primary: ['delts_front'], secondary: ['triceps', 'delts_side'],
    category: 'compound', pattern: 'vertical_press', equipment: 'dumbbell', increment: 2, failureSafe: false, fatigue: 2,
    repRange: [8, 12], loadNote: 'kg por mancuerna',
    cues: ['Sentado con respaldo', 'Bajar hasta la altura de las orejas'],
  },
  {
    id: 'machine_shoulder_press', name: 'Press de hombro en máquina', primary: ['delts_front'], secondary: ['triceps', 'delts_side'],
    category: 'machine', pattern: 'vertical_press', equipment: 'machine', increment: 5, failureSafe: true, fatigue: 1,
    repRange: [8, 12],
    cues: ['Espalda apoyada', 'Recorrido completo'],
  },
  {
    id: 'db_lateral_raise', name: 'Elevaciones laterales con mancuernas', primary: ['delts_side'], secondary: [],
    category: 'isolation', pattern: 'lateral_raise', equipment: 'dumbbell', increment: 1, failureSafe: true, fatigue: 1,
    repRange: [12, 20], loadNote: 'kg por mancuerna',
    cues: ['Subir hacia los lados, no hacia delante', 'Sin impulso; bajar lento'],
  },
  {
    id: 'cable_lateral_raise', name: 'Elevaciones laterales en polea', primary: ['delts_side'], secondary: [],
    category: 'isolation', pattern: 'lateral_raise', equipment: 'cable', increment: 1.25, failureSafe: true, fatigue: 1,
    repRange: [12, 20],
    cues: ['Polea a la altura de la mano', 'Tensión constante'],
  },
  {
    id: 'reverse_pec_deck', name: 'Pájaros en máquina (contractor inverso)', primary: ['delts_rear'], secondary: ['traps'],
    category: 'isolation', pattern: 'rear_fly', equipment: 'machine', increment: 5, failureSafe: true, fatigue: 1,
    repRange: [12, 20],
    cues: ['Brazos abiertos hacia atrás, no hacia abajo', 'Sin juntar escápulas en exceso'],
  },
  {
    id: 'face_pull', name: 'Face pull en polea', primary: ['delts_rear'], secondary: ['traps'],
    category: 'isolation', pattern: 'rear_fly', equipment: 'cable', increment: 2.5, failureSafe: true, fatigue: 1,
    repRange: [12, 20],
    cues: ['Cuerda hacia la frente', 'Codos altos y abiertos'],
  },
  {
    id: 'db_rear_delt_fly', name: 'Pájaros con mancuernas', primary: ['delts_rear'], secondary: [],
    category: 'isolation', pattern: 'rear_fly', equipment: 'dumbbell', increment: 1, failureSafe: true, fatigue: 1,
    repRange: [12, 20], loadNote: 'kg por mancuerna',
    cues: ['Torso inclinado y estable', 'Movimiento lento y controlado'],
  },

  // Bíceps
  {
    id: 'barbell_curl', name: 'Curl con barra (EZ o recta)', primary: ['biceps'], secondary: [],
    category: 'isolation', pattern: 'curl', equipment: 'barbell', increment: 2.5, failureSafe: true, fatigue: 1,
    repRange: [8, 12],
    cues: ['Codos fijos junto al cuerpo', 'Sin balanceo'],
  },
  {
    id: 'incline_db_curl', name: 'Curl inclinado con mancuernas', primary: ['biceps'], secondary: [],
    category: 'isolation', pattern: 'curl', equipment: 'dumbbell', increment: 1, failureSafe: true, fatigue: 1,
    repRange: [10, 15], loadNote: 'kg por mancuerna',
    cues: ['Brazos colgando por detrás del torso', 'Extensión completa abajo'],
  },
  {
    id: 'cable_curl', name: 'Curl en polea', primary: ['biceps'], secondary: [],
    category: 'isolation', pattern: 'curl', equipment: 'cable', increment: 2.5, failureSafe: true, fatigue: 1,
    repRange: [10, 15],
    cues: ['Codos quietos', 'Apretar arriba un instante'],
  },
  {
    id: 'hammer_curl', name: 'Curl martillo', primary: ['biceps'], secondary: [],
    category: 'isolation', pattern: 'curl', equipment: 'dumbbell', increment: 2, failureSafe: true, fatigue: 1,
    repRange: [8, 12], loadNote: 'kg por mancuerna',
    cues: ['Agarre neutro', 'Sin balanceo del torso'],
  },
  {
    id: 'machine_preacher_curl', name: 'Curl predicador en máquina', primary: ['biceps'], secondary: [],
    category: 'isolation', pattern: 'curl', equipment: 'machine', increment: 5, failureSafe: true, fatigue: 1,
    repRange: [10, 15],
    cues: ['Axila pegada al soporte', 'Extender por completo con control'],
  },

  // Tríceps
  {
    id: 'cable_pushdown', name: 'Extensión de tríceps en polea', primary: ['triceps'], secondary: [],
    category: 'isolation', pattern: 'elbow_extension', equipment: 'cable', increment: 2.5, failureSafe: true, fatigue: 1,
    repRange: [10, 15],
    cues: ['Codos pegados al torso', 'Extender por completo abajo'],
  },
  {
    id: 'overhead_cable_ext', name: 'Extensión de tríceps sobre la cabeza en polea', primary: ['triceps'], secondary: [],
    category: 'isolation', pattern: 'overhead_extension', equipment: 'cable', increment: 2.5, failureSafe: true, fatigue: 1,
    repRange: [10, 15],
    cues: ['Codos apuntando hacia delante', 'Buscar el estiramiento detrás de la cabeza'],
  },
  {
    id: 'skull_crusher', name: 'Press francés con barra EZ', primary: ['triceps'], secondary: [],
    category: 'isolation', pattern: 'overhead_extension', equipment: 'barbell', increment: 2.5, failureSafe: false, fatigue: 1,
    repRange: [8, 12],
    cues: ['Bajar la barra detrás de la frente', 'Codos estables'],
  },
  {
    id: 'close_grip_bench', name: 'Press de banca agarre cerrado', primary: ['triceps'], secondary: ['chest', 'delts_front'],
    category: 'compound', pattern: 'horizontal_press', equipment: 'barbell', increment: 2.5, failureSafe: false, fatigue: 2,
    cues: ['Manos a la anchura de los hombros', 'Codos cerca del cuerpo'],
  },
  {
    id: 'db_overhead_ext', name: 'Extensión sobre la cabeza con mancuerna', primary: ['triceps'], secondary: [],
    category: 'isolation', pattern: 'overhead_extension', equipment: 'dumbbell', increment: 2, failureSafe: true, fatigue: 1,
    repRange: [10, 15],
    cues: ['Sostener la mancuerna con ambas manos', 'Bajar detrás de la cabeza con control'],
  },

  // Cuádriceps
  {
    id: 'back_squat', name: 'Sentadilla trasera con barra', primary: ['quads'], secondary: ['glutes'],
    category: 'compound', pattern: 'squat', equipment: 'barbell', increment: 2.5, failureSafe: false, fatigue: 3,
    cues: ['Bracing antes de bajar', 'Rodillas en la dirección de los pies', 'Profundidad que mantenga la espalda neutra'],
  },
  {
    id: 'hack_squat', name: 'Sentadilla hack', primary: ['quads'], secondary: ['glutes'],
    category: 'machine', pattern: 'squat', equipment: 'machine', increment: 5, failureSafe: true, fatigue: 2,
    repRange: [8, 12],
    cues: ['Pies a media plataforma', 'Bajar profundo con control'],
  },
  {
    id: 'leg_press', name: 'Prensa de piernas', primary: ['quads'], secondary: ['glutes'],
    category: 'machine', pattern: 'leg_press', equipment: 'machine', increment: 5, failureSafe: true, fatigue: 2,
    repRange: [8, 12],
    cues: ['Zona lumbar apoyada todo el recorrido', 'No bloquear las rodillas arriba'],
  },
  {
    id: 'smith_squat', name: 'Sentadilla en máquina Smith', primary: ['quads'], secondary: ['glutes'],
    category: 'machine', pattern: 'squat', equipment: 'smith', increment: 2.5, failureSafe: true, fatigue: 2,
    repRange: [8, 12],
    cues: ['Pies ligeramente adelantados', 'Profundidad completa con control'],
  },
  {
    id: 'bulgarian_split_squat', name: 'Sentadilla búlgara', primary: ['quads'], secondary: ['glutes'],
    category: 'compound', pattern: 'lunge', equipment: 'dumbbell', increment: 2, failureSafe: false, fatigue: 2,
    repRange: [8, 12], loadNote: 'kg por mancuerna',
    cues: ['Torso ligeramente inclinado', 'Bajar vertical, rodilla delantera estable'],
  },
  {
    id: 'goblet_squat', name: 'Sentadilla goblet', primary: ['quads'], secondary: ['glutes'],
    category: 'compound', pattern: 'squat', equipment: 'dumbbell', increment: 2, failureSafe: true, fatigue: 1,
    repRange: [10, 15],
    cues: ['Mancuerna pegada al pecho', 'Codos entre las rodillas abajo'],
  },
  {
    id: 'leg_extension', name: 'Extensión de cuádriceps', primary: ['quads'], secondary: [],
    category: 'isolation', pattern: 'knee_extension', equipment: 'machine', increment: 5, failureSafe: true, fatigue: 1,
    repRange: [10, 15],
    cues: ['Rodilla alineada con el eje de la máquina', 'Pausa breve arriba'],
  },

  // Isquiotibiales y glúteos
  {
    id: 'rdl', name: 'Peso muerto rumano', primary: ['hamstrings'], secondary: ['glutes'],
    category: 'compound', pattern: 'hinge', equipment: 'barbell', increment: 2.5, failureSafe: false, fatigue: 3,
    repRange: [6, 10],
    cues: ['Cadera atrás, rodillas semiflexionadas', 'Barra pegada a las piernas', 'Bajar hasta el estiramiento sin redondear'],
  },
  {
    id: 'db_rdl', name: 'Peso muerto rumano con mancuernas', primary: ['hamstrings'], secondary: ['glutes'],
    category: 'compound', pattern: 'hinge', equipment: 'dumbbell', increment: 2, failureSafe: false, fatigue: 2,
    repRange: [8, 12], loadNote: 'kg por mancuerna',
    cues: ['Cadera atrás', 'Espalda neutra'],
  },
  {
    id: 'lying_leg_curl', name: 'Curl femoral tumbado', primary: ['hamstrings'], secondary: [],
    category: 'isolation', pattern: 'knee_flexion', equipment: 'machine', increment: 5, failureSafe: true, fatigue: 1,
    repRange: [8, 12],
    cues: ['Cadera pegada al banco', 'Bajar lento'],
  },
  {
    id: 'seated_leg_curl', name: 'Curl femoral sentado', primary: ['hamstrings'], secondary: [],
    category: 'isolation', pattern: 'knee_flexion', equipment: 'machine', increment: 5, failureSafe: true, fatigue: 1,
    repRange: [10, 15],
    cues: ['Inclinar el torso hacia delante para más estiramiento', 'Recorrido completo'],
  },
  {
    id: 'hip_thrust', name: 'Hip thrust con barra', primary: ['glutes'], secondary: ['hamstrings'],
    category: 'machine', pattern: 'hip_thrust', equipment: 'barbell', increment: 2.5, failureSafe: true, fatigue: 2,
    repRange: [8, 12],
    cues: ['Mentón recogido', 'Extensión completa de cadera sin arquear la lumbar'],
  },
  {
    id: 'hip_abduction', name: 'Abducción de cadera en máquina', primary: ['glutes'], secondary: [],
    category: 'isolation', pattern: 'hip_abduction', equipment: 'machine', increment: 5, failureSafe: true, fatigue: 1,
    repRange: [12, 20],
    cues: ['Torso ligeramente inclinado hacia delante', 'Controlar el regreso'],
  },

  // Pantorrillas
  {
    id: 'standing_calf_raise', name: 'Elevación de talones de pie', primary: ['calves'], secondary: [],
    category: 'isolation', pattern: 'calf_raise', equipment: 'machine', increment: 5, failureSafe: true, fatigue: 1,
    repRange: [8, 12],
    cues: ['Pausa de 1–2 s abajo en estiramiento', 'Subir completamente sobre los dedos'],
  },
  {
    id: 'seated_calf_raise', name: 'Elevación de talones sentado', primary: ['calves'], secondary: [],
    category: 'isolation', pattern: 'calf_raise', equipment: 'machine', increment: 5, failureSafe: true, fatigue: 1,
    repRange: [15, 20],
    cues: ['Pausa abajo', 'Recorrido completo'],
  },
  {
    id: 'leg_press_calf', name: 'Elevación de talones en prensa', primary: ['calves'], secondary: [],
    category: 'isolation', pattern: 'calf_raise', equipment: 'machine', increment: 5, failureSafe: true, fatigue: 1,
    repRange: [12, 20],
    cues: ['Rodillas casi extendidas', 'Pausa en el estiramiento'],
  },
  {
    id: 'db_calf_raise', name: 'Elevación de talón a una pierna con mancuerna', primary: ['calves'], secondary: [],
    category: 'isolation', pattern: 'calf_raise', equipment: 'dumbbell', increment: 2, failureSafe: true, fatigue: 1,
    repRange: [10, 15],
    cues: ['Sobre un escalón para ganar recorrido', 'Pausa abajo'],
  },

  // Abdomen
  {
    id: 'cable_crunch', name: 'Crunch en polea', primary: ['abs'], secondary: [],
    category: 'isolation', pattern: 'trunk_flexion', equipment: 'cable', increment: 2.5, failureSafe: true, fatigue: 1,
    repRange: [10, 15],
    cues: ['Flexionar la columna, no la cadera', 'Exhalar al contraer'],
  },
  {
    id: 'hanging_leg_raise', name: 'Elevación de piernas colgado', primary: ['abs'], secondary: [],
    category: 'isolation', pattern: 'trunk_flexion', equipment: 'bodyweight', increment: 0, failureSafe: true, fatigue: 1,
    repRange: [10, 15],
    cues: ['Enrollar la pelvis hacia arriba', 'Sin balanceo'],
  },
]

const EXERCISE_MAP = new Map(EXERCISES.map((e) => [e.id, e]))

export function getExercise(id: string): Exercise {
  const ex = EXERCISE_MAP.get(id)
  if (!ex) throw new Error(`Ejercicio desconocido: ${id}`)
  return ex
}

const EQUIPMENT_BY_PROFILE: Record<EquipmentProfile, Equipment[]> = {
  full_gym: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'smith'],
  basic_gym: ['barbell', 'dumbbell', 'cable', 'bodyweight'],
  home: ['dumbbell', 'bodyweight'],
}

export function isAvailable(ex: Exercise, equipment: EquipmentProfile): boolean {
  return EQUIPMENT_BY_PROFILE[equipment].includes(ex.equipment)
}

const DEFAULT_REP_RANGE: Record<ExerciseCategory, [number, number]> = {
  compound: [6, 10],
  machine: [8, 12],
  isolation: [10, 15],
}

export function repRangeFor(ex: Exercise): [number, number] {
  return ex.repRange ?? DEFAULT_REP_RANGE[ex.category]
}

const DEFAULT_REST: Record<ExerciseCategory, number> = {
  compound: 150,
  machine: 120,
  isolation: 90,
}

export function restFor(ex: Exercise): number {
  return DEFAULT_REST[ex.category]
}

/** Alternativas que entrenan el mismo músculo principal con el equipamiento disponible. */
export function substitutesFor(
  exerciseId: string,
  equipment: EquipmentProfile,
  avoid: string[] = [],
): Exercise[] {
  const ex = getExercise(exerciseId)
  const main = ex.primary[0]
  return EXERCISES.filter(
    (e) => e.id !== ex.id && e.primary.includes(main) && isAvailable(e, equipment) && !avoid.includes(e.id),
  ).sort((a, b) => Number(b.pattern === ex.pattern) - Number(a.pattern === ex.pattern))
}
