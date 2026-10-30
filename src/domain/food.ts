import type { AddedFat, CustomFood, FoodLabel, FoodLog, FoodState, Macros, MealSlot, SharedFood } from './types'

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
  source: 'curated' | 'recipe' | 'usda' | 'custom' | 'shared'
  barcode?: string
  /** Ingredientes de una preparación (gramos crudos) y peso final cocido. */
  recipe?: { ingredients: { key: string; state: FoodState; grams: number }[]; yieldG: number }
}

export interface FoodUnit {
  label: string
  /** Estado al que corresponde la medida; undefined = cualquiera. */
  state?: FoodState
  grams: number
  hand?: boolean
  /** Se cuenta por piezas (huevos, tajadas, arepas…): aun con báscula, se registra por unidades. */
  count?: boolean
}

const COUNTED = /^(unidad|huevo|clara|yema|tajada|tira|arepa|patac|sobre|scoop)/i

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
    units: (f.u ?? []).map(([label, s, grams]) => ({ label, state: STATE[s], grams, count: COUNTED.test(label) || undefined })),
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

function labelToFood(l: FoodLabel, key: string, group: string, source: Food['source']): Food {
  return {
    key,
    // La marca solo si no está ya en el nombre («Nutella», no «Nutella (Nutella)»).
    name: l.brand && !normalize(l.name).includes(normalize(l.brand)) ? `${l.name} (${l.brand})` : l.name,
    aliases: l.brand ? [l.brand] : [],
    group,
    raw: l.per100,
    units: l.portion ? [{ label: l.portion.label, grams: l.portion.grams }] : [],
    fatPrompt: false,
    source,
    barcode: l.barcode,
  }
}

export function customToFood(c: CustomFood): Food {
  return { ...labelToFood(c, `custom:${c.id}`, 'Mis productos', 'custom'), fatPrompt: !!c.fatPrompt }
}

export function sharedToFood(s: SharedFood): Food {
  return labelToFood(s, `shared:${s.id}`, 'Productos del grupo', 'shared')
}

// --- Etiquetas y Open Food Facts ------------------------------------------------------------------

/**
 * Revisa que la etiqueta tenga sentido: las calorías deben cuadrar con 4 kcal/g de proteína y
 * carbohidratos y 9 kcal/g de grasa, y los macros no pueden pasar de 100 g por cada 100 g.
 */
export function checkLabel(m: Macros): string[] {
  const out: string[] = []
  if (m.kcal > 900) out.push('Más de 900 kcal por 100 g es imposible (el aceite puro tiene ~884): revisa si copiaste los valores de otra cantidad.')
  if (m.p + m.f + m.c > 101) {
    out.push('Proteína, grasa y carbohidratos suman más de 100 g por cada 100 g: quizá la porción no corresponde a esos valores.')
  }
  const computed = 4 * m.p + 4 * m.c + 9 * m.f
  const diff = Math.abs(m.kcal - computed)
  if ((m.kcal > 0 || computed > 0) && diff > Math.max(25, 0.2 * Math.max(m.kcal, computed))) {
    out.push(
      `Las calorías no cuadran con los macros: con esa proteína, grasa y carbohidratos serían unas ${Math.round(computed)} kcal por 100 g, ` +
        `no ${Math.round(m.kcal)}. Revisa la etiqueta (la fibra, los polialcoholes o el alcohol explican diferencias pequeñas).`,
    )
  }
  return out
}

/** Respuesta de la API de Open Food Facts (solo los campos que se piden). */
export interface OffProduct {
  product_name?: string
  product_name_es?: string
  generic_name?: string
  brands?: string
  serving_size?: string
  serving_quantity?: number | string
  nutriments?: Record<string, number | string | undefined>
}

export const OFF_FIELDS = 'product_name,product_name_es,generic_name,brands,serving_size,serving_quantity,nutriments'

/** Convierte un producto de Open Food Facts en datos de etiqueta; undefined si no trae calorías. */
export function offToLabel(p: OffProduct, barcode: string): FoodLabel | undefined {
  const n = p.nutriments ?? {}
  const num = (k: string) => {
    if (n[k] === undefined || n[k] === '') return undefined
    const v = Number(n[k])
    return Number.isFinite(v) ? v : undefined
  }
  const kj = num('energy_100g')
  const kcal = num('energy-kcal_100g') ?? (kj !== undefined ? kj / 4.184 : undefined)
  if (kcal === undefined) return undefined
  const r1 = (x: number | undefined) => Math.round((x ?? 0) * 10) / 10
  const serving = Number(p.serving_quantity)
  return {
    name: (p.product_name_es || p.product_name || p.generic_name || 'Producto sin nombre').trim(),
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    barcode,
    per100: { kcal: Math.round(kcal), p: r1(num('proteins_100g')), f: r1(num('fat_100g')), c: r1(num('carbohydrates_100g')), fib: r1(num('fiber_100g')) },
    portion: serving > 0 ? { label: p.serving_size?.trim() || 'Porción', grams: serving } : undefined,
  }
}

/** Busca un código de barras en Open Food Facts (base abierta, licencia ODbL). */
export async function fetchOpenFoodFacts(barcode: string): Promise<FoodLabel | undefined> {
  const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`)
  if (r.status === 404) return undefined
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const data = (await r.json()) as { status?: number; product?: OffProduct }
  return data.status === 1 && data.product ? offToLabel(data.product, barcode) : undefined
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
  if (/^\d{8,14}$/.test(q)) return foods.filter((f) => f.barcode === q)
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
    if (f.source === 'custom' || f.source === 'shared') s += 60
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
