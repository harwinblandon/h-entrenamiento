import type { AddedFat, CustomFood, FoodLog, FoodState, Macros, MealSlot } from './types'

/** Alimento listo para registrar: valores por 100 g en crudo y/o cocido. */
export interface Food {
  key: string
  name: string
  aliases: string[]
  group: string
  raw?: Macros
  cooked?: Macros
  /** Id del USDA FoodData Central (0 si el valor es aproximado). */
  fdc?: { raw?: number; cooked?: number }
  units: FoodUnit[]
  /** Suele prepararse con aceite o mantequilla: hay que preguntar cuánto se usó. */
  fatPrompt: boolean
  source: 'curated' | 'recipe' | 'usda' | 'custom'
  /** Ingredientes de una preparación (gramos crudos) y peso final cocido. */
  recipe?: { ingredients: { key: string; state: FoodState; grams: number }[]; yieldG: number }
}

export interface FoodUnit {
  label: string
  /** Estado al que corresponde la medida; undefined = cualquiera. */
  state?: FoodState
  grams: number
  hand?: boolean
}

export const MEALS: { id: MealSlot; label: string }[] = [
  { id: 'breakfast', label: 'Desayuno' },
  { id: 'midmorning', label: 'Media mañana' },
  { id: 'lunch', label: 'Almuerzo' },
  { id: 'afternoon', label: 'Algo' },
  { id: 'dinner', label: 'Comida o cena' },
]

export const ZERO: Macros = { kcal: 0, p: 0, f: 0, c: 0, fib: 0 }

type Row = [number, number, number, number, number, number?]
interface RawFood {
  k: string
  n: string
  a: string[]
  g: string
  r?: Row
  c?: Row
  u?: [string, 'r' | 'c' | 'a', number][]
  fat?: 1
  ing?: [string, 'r' | 'c', number][]
  yield?: number
}
export interface FoodDbJson {
  source: string
  foods: RawFood[]
  recipes: RawFood[]
  usda: [number, string, number, number, number, number, number][]
}

const toMacros = (r: Row | number[]): Macros => ({ kcal: r[0], p: r[1], f: r[2], c: r[3], fib: r[4] })
const STATE = { r: 'raw', c: 'cooked', a: undefined } as const

const PROTEIN_GROUPS = ['Res', 'Cerdo', 'Pollo', 'Pescado']
const STARCH_GROUPS = ['Cereales', 'Tubérculos', 'Leguminosas', 'Preparaciones']

/** Porciones con la mano (guía práctica para quien no pesa la comida; varían con el tamaño de la mano). */
export function handUnits(food: Pick<Food, 'group' | 'raw' | 'cooked' | 'key'>): FoodUnit[] {
  const has = (s: FoodState) => (s === 'raw' ? food.raw : food.cooked) !== undefined
  if (PROTEIN_GROUPS.includes(food.group)) {
    if (has('cooked')) return [{ label: 'Palma', state: 'cooked', grams: 100, hand: true }]
    return [{ label: 'Palma', state: 'raw', grams: 130, hand: true }]
  }
  if (STARCH_GROUPS.includes(food.group) && has('cooked')) return [{ label: 'Puño', state: 'cooked', grams: 150, hand: true }]
  if (food.group === 'Verduras') return [{ label: 'Puño', state: has('cooked') ? undefined : 'raw', grams: 80, hand: true }]
  if (food.group === 'Frutas') return [{ label: 'Puño', state: 'raw', grams: 130, hand: true }]
  if ((food.group === 'Grasas' || food.group === 'Frutos secos') && food.key !== 'aguacate') {
    return [{ label: 'Pulgar', state: has('raw') ? 'raw' : undefined, grams: 15, hand: true }]
  }
  return []
}

function fromRaw(f: RawFood, source: Food['source']): Food {
  const food: Food = {
    key: f.k,
    name: f.n,
    aliases: f.a,
    group: f.g,
    raw: f.r && toMacros(f.r),
    cooked: f.c && toMacros(f.c),
    fdc: { raw: f.r?.[5], cooked: f.c?.[5] },
    units: (f.u ?? []).map(([label, s, grams]) => ({ label, state: STATE[s], grams })),
    fatPrompt: f.fat === 1,
    source,
  }
  if (f.ing && f.yield) {
    food.recipe = { ingredients: f.ing.map(([key, s, grams]) => ({ key, state: STATE[s] ?? 'raw', grams })), yieldG: f.yield }
  }
  food.units.push(...handUnits(food))
  return food
}

export interface FoodDb {
  source: string
  foods: Food[]
  byKey: Map<string, Food>
}

export function parseFoodDb(json: FoodDbJson): FoodDb {
  const foods = [
    ...json.foods.map((f) => fromRaw(f, 'curated')),
    ...json.recipes.map((f) => fromRaw(f, 'recipe')),
    ...json.usda.map(
      ([id, desc, ...m]): Food => ({
        key: `usda:${id}`,
        name: desc,
        aliases: [],
        group: 'USDA',
        raw: toMacros(m),
        fdc: { raw: id },
        units: [],
        fatPrompt: false,
        source: 'usda',
      }),
    ),
  ]
  return { source: json.source, foods, byKey: new Map(foods.map((f) => [f.key, f])) }
}

let loading: Promise<FoodDb> | undefined

/** Carga la base de alimentos bajo demanda (no pesa en el arranque de la app). */
export function loadFoodDb(): Promise<FoodDb> {
  loading ??= fetch('./data/foods.json')
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() as Promise<FoodDbJson>
    })
    .then(parseFoodDb)
    .catch((e) => {
      loading = undefined
      throw e
    })
  return loading
}

export function customToFood(c: CustomFood): Food {
  return {
    key: `custom:${c.id}`,
    name: c.brand ? `${c.name} (${c.brand})` : c.name,
    aliases: [],
    group: 'Mis productos',
    raw: c.per100,
    units: c.portion ? [{ label: c.portion.label, grams: c.portion.grams }] : [],
    fatPrompt: !!c.fatPrompt,
    source: 'custom',
  }
}

export const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()

/** Busca por nombre y sinónimos; primero lo propio y lo curado, luego la base del USDA (en inglés). */
export function searchFoods(foods: Food[], query: string, limit = 30): Food[] {
  const q = normalize(query)
  if (q.length < 2) return []
  const words = q.split(/\s+/)
  const scored: { f: Food; s: number }[] = []
  for (const f of foods) {
    const name = normalize(f.name)
    const texts = [name, ...f.aliases.map(normalize)]
    if (!words.every((w) => texts.some((t) => t.includes(w)))) continue
    let s = 0
    if (name === q || f.aliases.some((a) => normalize(a) === q)) s += 100
    if (name.startsWith(q)) s += 50
    else if (texts.some((t) => t.startsWith(words[0]))) s += 30
    if (f.source === 'custom') s += 60
    else if (f.source === 'curated' || f.source === 'recipe') s += 40
    s -= name.length / 20
    scored.push({ f, s })
  }
  return scored
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.f)
}

export function per100For(food: Food, state: FoodState): Macros {
  return (state === 'raw' ? food.raw ?? food.cooked : food.cooked ?? food.raw) ?? ZERO
}

/** Estado por defecto: el que exista; si hay ambos, crudo (pesar en crudo es lo más consistente). */
export function defaultState(food: Food): FoodState {
  return food.raw ? 'raw' : 'cooked'
}

/**
 * Gramos cocidos que salen de 100 g crudos, estimados por la densidad calórica (agua que gana o pierde).
 * Solo para alimentos con ambos valores; p. ej. arroz ~280 g, pechuga ~73 g.
 */
export function cookedPer100Raw(food: Food): number | undefined {
  if (!food.raw || !food.cooked || food.cooked.kcal <= 0 || food.recipe) return undefined
  return Math.round((food.raw.kcal / food.cooked.kcal) * 100)
}

export function scale(m: Macros, grams: number): Macros {
  const k = grams / 100
  return { kcal: m.kcal * k, p: m.p * k, f: m.f * k, c: m.c * k, fib: m.fib * k }
}

export function add(a: Macros, b: Macros): Macros {
  return { kcal: a.kcal + b.kcal, p: a.p + b.p, f: a.f + b.f, c: a.c + b.c, fib: a.fib + b.fib }
}

export function entryMacros(e: Pick<FoodLog, 'per100' | 'grams' | 'addedFat'>): Macros {
  const base = scale(e.per100, e.grams)
  return e.addedFat ? add(base, scale(e.addedFat.per100, e.addedFat.grams)) : base
}

export function totals(entries: Pick<FoodLog, 'per100' | 'grams' | 'addedFat'>[]): Macros {
  return entries.reduce((acc, e) => add(acc, entryMacros(e)), ZERO)
}

// --- Grasa de cocción --------------------------------------------------------------------------

export const FAT_SOURCES = ['aceite', 'aceite_oliva', 'mantequilla', 'manteca', 'margarina'] as const

/** Medidas de grasa de cocción en gramos (aceite: cucharadita 4,5 g; cucharada 13,6 g). */
export const FAT_MEASURES = [
  { id: 'tsp', label: 'Cucharadita', oilG: 4.5, solidG: 5 },
  { id: 'tbsp', label: 'Cucharada', oilG: 13.6, solidG: 14 },
  { id: 'g', label: 'Gramos', oilG: 1, solidG: 1 },
] as const
export type FatMeasure = (typeof FAT_MEASURES)[number]['id']

/** Gramos de grasa que le tocan a una porción: la cantidad usada en la olla dividida entre las porciones. */
export function fatPerPortion(sourceKey: string, measure: FatMeasure, amount: number, portions: number): number {
  const m = FAT_MEASURES.find((x) => x.id === measure)!
  const liquid = sourceKey.startsWith('aceite')
  const grams = amount * (liquid ? m.oilG : m.solidG)
  return Math.round((grams / Math.max(1, portions)) * 10) / 10
}

export function fatNote(measure: FatMeasure, amount: number, portions: number): string {
  const m = FAT_MEASURES.find((x) => x.id === measure)!
  const qty = measure === 'g' ? `${amount} g` : `${fmtNum(amount)} ${m.label.toLowerCase()}${amount === 1 ? '' : 's'}`
  return portions > 1 ? `${qty} para ${portions} porciones` : qty
}

export function makeAddedFat(db: FoodDb, sourceKey: string, measure: FatMeasure, amount: number, portions: number): AddedFat | undefined {
  const src = db.byKey.get(sourceKey)
  if (!src || amount <= 0) return undefined
  return {
    foodKey: sourceKey,
    name: src.name,
    grams: fatPerPortion(sourceKey, measure, amount, portions),
    per100: per100For(src, 'raw'),
    note: fatNote(measure, amount, portions),
    input: { measure, amount, portions },
  }
}

export const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString('es', { maximumFractionDigits: 1 }))

// --- Retroalimentación del día --------------------------------------------------------------------

export interface DayTargets {
  kcal: number
  proteinG: number
  fatG: number
  carbsG: number
}

export interface Feedback {
  tone: 'ok' | 'warn' | 'info'
  text: string
}

/** Proteína aproximada de una palma de carne, pollo o pescado cocido. */
export const PALM_PROTEIN_G = 25

/**
 * Mensajes sencillos para orientar el día. `complete` indica que el día ya terminó (o la persona lo
 * marcó así): entonces se juzga el total; si no, se habla de lo que falta.
 */
export function dayFeedback(t: Macros, target: DayTargets, entries: FoodLog[], groups: Map<string, string>, complete: boolean): Feedback[] {
  const out: Feedback[] = []
  if (entries.length === 0) return out
  const kcalPct = t.kcal / target.kcal
  const missingP = target.proteinG - t.p

  if (complete) {
    if (kcalPct < 0.85) out.push({ tone: 'warn', text: `Quedaste en ${Math.round(kcalPct * 100)} % de tus calorías. Si pasa seguido, revisa si olvidaste registrar algo (bebidas, aceite, salsas, picadas).` })
    else if (kcalPct > 1.1) out.push({ tone: 'warn', text: `Pasaste tus calorías en ${Math.round((kcalPct - 1) * 100)} %. Un día no cambia nada; lo que cuenta es el promedio de la semana.` })
    else out.push({ tone: 'ok', text: 'Calorías dentro del rango del objetivo. ¡Bien!' })
  } else if (kcalPct > 1.1) {
    out.push({ tone: 'warn', text: 'Ya pasaste tus calorías del día. Si te da hambre, prefiere verduras y proteína magra.' })
  }

  if (missingP > PALM_PROTEIN_G * 0.6) {
    const palms = Math.max(1, Math.round((missingP / PALM_PROTEIN_G) * 2) / 2)
    out.push({
      tone: complete ? 'warn' : 'info',
      text: `${complete ? 'Faltaron' : 'Te faltan'} ~${Math.round(missingP)} g de proteína: unas ${fmtNum(palms)} palma${palms === 1 ? '' : 's'} de pollo, carne, pescado o huevos (~${PALM_PROTEIN_G} g cada una).`,
    })
  } else {
    out.push({ tone: 'ok', text: 'Proteína cubierta.' })
  }

  const veg = entries.some((e) => groups.get(e.foodKey) === 'Verduras')
  if (!veg) out.push({ tone: 'info', text: 'No hay verduras registradas: un puño en el almuerzo y otro en la cena aportan fibra y saciedad con pocas calorías.' })

  const fatPct = (t.f * 9) / Math.max(1, t.kcal)
  if (t.kcal > 600 && fatPct > 0.4) {
    out.push({ tone: 'warn', text: `El ${Math.round(fatPct * 100)} % de las calorías viene de grasa. Revisa frituras, aceite de cocción, queso y salsas.` })
  }
  return out
}
