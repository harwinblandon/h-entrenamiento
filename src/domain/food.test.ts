import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  checkLabel,
  cookedPer100Raw,
  dayFeedback,
  entryMacros,
  fatPerPortion,
  makeAddedFat,
  offToLabel,
  parseFoodDb,
  per100For,
  searchFoods,
  type FoodDbJson,
} from './food'
import type { FoodLog } from './types'

const json = JSON.parse(readFileSync(new URL('../../public/data/foods.json', import.meta.url), 'utf-8')) as FoodDbJson
const fdb = parseFoodDb(json)
const food = (k: string) => fdb.byKey.get(k)!

describe('base de alimentos', () => {
  it('tiene los alimentos curados, las preparaciones y la base completa del USDA', () => {
    expect(json.foods.length).toBeGreaterThan(150)
    expect(json.recipes.length).toBeGreaterThan(10)
    expect(json.usda.length).toBeGreaterThan(5000)
    for (const f of fdb.foods.filter((x) => x.source !== 'usda')) {
      expect(f.raw ?? f.cooked, f.key).toBeDefined()
    }
  })

  it('distingue los cortes de carne', () => {
    expect(food('lomo_cerdo').raw!.f).toBeLessThan(food('pecho_res').raw!.f)
    expect(food('entrana').cooked!.f).toBeGreaterThan(food('cuadrada').cooked!.f)
  })

  it('estima el rendimiento de crudo a cocido', () => {
    expect(cookedPer100Raw(food('arroz_blanco'))).toBeGreaterThan(250)
    expect(cookedPer100Raw(food('pechuga'))).toBeLessThan(80)
  })

  it('busca en español, sin tildes y por sinónimos', () => {
    expect(searchFoods(fdb.foods, 'arroz')[0].key).toBe('arroz_blanco')
    expect(searchFoods(fdb.foods, 'lomo cerdo')[0].key).toBe('lomo_cerdo')
    expect(searchFoods(fdb.foods, 'entrana')[0].key).toBe('entrana')
    expect(searchFoods(fdb.foods, 'patilla')[0].key).toBe('sandia')
    expect(searchFoods(fdb.foods, 'salsa negra')[0].key).toBe('salsa_negra')
  })

  it('pregunta por el aceite en lo que suele llevarlo y ofrece porciones con la mano', () => {
    expect(food('arroz_blanco').fatPrompt).toBe(true)
    expect(food('banano').fatPrompt).toBe(false)
    expect(food('pechuga').units.find((u) => u.hand)).toMatchObject({ label: 'Palma', state: 'cooked', grams: 100 })
  })

  it('cuenta los huevos por unidad según su clasificación', () => {
    const egg = food('huevo').units
    expect(egg.map((u) => u.label)).toEqual(['Huevo A', 'Huevo AA', 'Huevo AAA', 'Huevo Jumbo'])
    expect(egg.every((u) => u.count)).toBe(true)
    expect(egg.find((u) => u.label === 'Huevo AA')!.grams).toBe(56)
    expect(food('arroz_blanco').units.some((u) => u.count)).toBe(false)
  })
})

describe('registro con grasa de cocción', () => {
  it('reparte el aceite entre las porciones preparadas', () => {
    expect(fatPerPortion('aceite', 'tbsp', 1, 5)).toBe(2.7)
    expect(fatPerPortion('mantequilla', 'tsp', 2, 1)).toBe(10)
  })

  it('suma el aceite al arroz', () => {
    const rice = food('arroz_blanco')
    const plain = entryMacros({ per100: per100For(rice, 'raw'), grams: 100 })
    const withOil = entryMacros({ per100: per100For(rice, 'raw'), grams: 100, addedFat: makeAddedFat(fdb, 'aceite', 'tbsp', 1, 1) })
    expect(plain.kcal).toBeCloseTo(365, 0)
    expect(withOil.kcal - plain.kcal).toBeCloseTo(120, 0)
    expect(withOil.f - plain.f).toBeCloseTo(13.6, 1)
  })
})

describe('retroalimentación del día', () => {
  const targets = { kcal: 2400, proteinG: 150, fatG: 70, carbsG: 290 }
  const entry = (foodKey: string, grams: number, state: 'raw' | 'cooked' = 'cooked'): FoodLog => ({
    id: foodKey,
    profileId: 'p',
    date: '2026-10-30',
    meal: 'lunch',
    foodKey,
    name: foodKey,
    state,
    grams,
    per100: per100For(food(foodKey), state),
    createdAt: '',
  })
  const groups = new Map(fdb.foods.map((f) => [f.key, f.group]))

  it('indica la proteína que falta en palmas y la falta de verduras', () => {
    const entries = [entry('arroz_blanco', 300)]
    const fb = dayFeedback(entryMacros(entries[0]), targets, entries, groups, false)
    expect(fb.some((f) => f.text.includes('palmas'))).toBe(true)
    expect(fb.some((f) => f.text.includes('verduras'))).toBe(true)
  })

  it('al cerrar el día juzga las calorías', () => {
    const entries = [entry('arroz_blanco', 300)]
    const fb = dayFeedback(entryMacros(entries[0]), targets, entries, groups, true)
    expect(fb[0]).toMatchObject({ tone: 'warn' })
    expect(fb[0].text).toContain('olvidaste')
  })
})

describe('productos con etiqueta', () => {
  it('acepta una etiqueta coherente', () => {
    // Queso campesino: 299 kcal, P 18, G 24, C 3 por 100 g.
    expect(checkLabel({ kcal: 299, p: 18.1, f: 23.8, c: 3, fib: 0 })).toEqual([])
  })

  it('avisa si las calorías no cuadran con los macros', () => {
    const w = checkLabel({ kcal: 140, p: 6.7, f: 20, c: 66.7, fib: 0 })
    expect(w).toHaveLength(1)
    expect(w[0]).toContain('no cuadran')
  })

  it('avisa si los macros pasan de 100 g por 100 g', () => {
    expect(checkLabel({ kcal: 500, p: 40, f: 20, c: 60, fib: 0 }).some((x) => x.includes('100 g'))).toBe(true)
  })

  it('lee un producto de Open Food Facts, con energía en kJ si no hay kcal', () => {
    const label = offToLabel(
      {
        product_name: 'Galletas de avena',
        brands: 'Marca X, Otra',
        serving_size: '3 galletas (30 g)',
        serving_quantity: '30',
        nutriments: { energy_100g: 1966, proteins_100g: 7, fat_100g: 20, carbohydrates_100g: 65, fiber_100g: 4 },
      },
      '7701234567890',
    )!
    expect(label.per100.kcal).toBe(470)
    expect(label.brand).toBe('Marca X')
    expect(label.portion).toEqual({ label: '3 galletas (30 g)', grams: 30 })
    expect(offToLabel({ product_name: 'Sin datos', nutriments: {} }, '123')).toBeUndefined()
  })

  it('encuentra productos por código de barras', () => {
    const foods = [{ ...food('banano'), key: 'shared:1', barcode: '7701234567890', source: 'shared' as const }, ...fdb.foods]
    expect(searchFoods(foods, '7701234567890').map((f) => f.key)).toEqual(['shared:1'])
  })
})
