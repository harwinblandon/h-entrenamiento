import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { db } from '../../db/db'
import {
  cookedPer100Raw,
  customToFood,
  dayFeedback,
  defaultState,
  entryMacros,
  FAT_MEASURES,
  FAT_SOURCES,
  fmtNum,
  loadFoodDb,
  makeAddedFat,
  MEALS,
  PALM_PROTEIN_G,
  per100For,
  scale,
  searchFoods,
  totals,
  type DayTargets,
  type FatMeasure,
  type Food,
  type FoodDb,
} from '../../domain/food'
import { todayISO } from '../../domain/schedule'
import type { CustomFood, FoodLog, FoodState, Macros, MealSlot, Profile } from '../../domain/types'

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return todayISO(d)
}

function dateLabel(iso: string): string {
  const today = todayISO()
  if (iso === today) return 'Hoy'
  if (iso === addDays(today, -1)) return 'Ayer'
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })
}

const r0 = (n: number) => Math.round(n)

/** «150 g crudo», «1 palma (100 g) cocido», «2 × 3 galletas (60 g)». El estado solo si el alimento tiene ambos. */
function amountText(e: FoodLog, food?: Food): string {
  const amount = e.measure
    ? `${e.measure.count === 1 ? '' : `${fmtNum(e.measure.count)} × `}${e.measure.label.toLowerCase()} (${r0(e.grams)} g)`
    : `${fmtNum(e.grams)} g`
  const both = food ? food.raw && food.cooked && !food.recipe : false
  return both ? `${amount} ${e.state === 'raw' ? 'crudo' : 'cocido'}` : amount
}

function useFoodDb() {
  const [state, setState] = useState<{ db?: FoodDb; error?: string }>({})
  useEffect(() => {
    let alive = true
    loadFoodDb().then(
      (db) => alive && setState({ db }),
      () =>
        alive &&
        setState({
          error: 'No se pudo cargar la base de alimentos. Revisa la conexión e intenta de nuevo.',
        }),
    )
    return () => {
      alive = false
    }
  }, [])
  return state
}

/** Alimento equivalente a un registro cuyo alimento ya no está en la base (p. ej. un producto borrado). */
function foodFromEntry(e: FoodLog): Food {
  return {
    key: e.foodKey,
    name: e.name,
    aliases: [],
    group: '',
    [e.state]: e.per100,
    units: [],
    fatPrompt: !!e.addedFat,
    source: 'custom',
  }
}

function MacroLine({ m }: { m: Macros }) {
  return (
    <span className="muted" style={{ fontSize: '0.8rem' }}>
      P {r0(m.p)} · G {r0(m.f)} · C {r0(m.c)}
    </span>
  )
}

function Progress({ label, value, target, unit }: { label: string; value: number; target: number; unit: string }) {
  const pct = target > 0 ? value / target : 0
  return (
    <div className="stack-sm" style={{ gap: 4 }}>
      <div className="spread" style={{ fontSize: '0.85rem' }}>
        <span>{label}</span>
        <span className="muted">
          {r0(value)} / {r0(target)} {unit}
        </span>
      </div>
      <div className={`bar${pct > 1.1 ? ' warn' : ''}`}>
        <span style={{ width: `${Math.min(100, pct * 100)}%` }} />
      </div>
    </div>
  )
}

// --- Editor de un registro ---------------------------------------------------------------------------

interface Draft {
  food: Food
  entry?: FoodLog
}

function EntryEditor({
  draft,
  db: foodDb,
  last,
  meal,
  hands,
  onSave,
  onCancel,
}: {
  draft: Draft
  db: FoodDb
  last?: FoodLog
  meal: MealSlot
  hands: boolean
  onSave: (e: Omit<FoodLog, 'id' | 'profileId' | 'date' | 'createdAt'>) => void
  onCancel: () => void
}) {
  const { food, entry } = draft
  const prev = entry ?? last
  const allUnits = food.units
  const initialUnit = prev?.measure ? allUnits.findIndex((u) => u.label === prev.measure!.label) : hands && allUnits.length ? 0 : -1
  const prevState = prev?.state && (prev.state === 'raw' ? food.raw : food.cooked) ? prev.state : undefined
  const [state, setState] = useState<FoodState>(allUnits[initialUnit]?.state ?? prevState ?? defaultState(food))
  const [unitIdx, setUnitIdx] = useState(initialUnit)
  const [count, setCount] = useState(prev?.measure?.count ?? 1)
  const [gramsText, setGramsText] = useState(prev && !prev.measure ? String(prev.grams) : '')

  const prevFat = prev ? prev.addedFat : undefined
  const [fatUsed, setFatUsed] = useState<boolean | undefined>(prev ? !!prevFat : undefined)
  const [fatSource, setFatSource] = useState(prevFat?.foodKey ?? 'aceite')
  const [fatMeasure, setFatMeasure] = useState<FatMeasure>(prevFat?.input?.measure ?? 'tbsp')
  const [fatAmount, setFatAmount] = useState(String(prevFat?.input?.amount ?? 1))
  const [portions, setPortions] = useState(String(prevFat?.input?.portions ?? 1))
  const [fatOpen, setFatOpen] = useState(food.fatPrompt || !!prevFat)

  const unit = unitIdx >= 0 ? allUnits[unitIdx] : undefined
  const grams = unit ? unit.grams * count : Number(gramsText.replace(',', '.')) || 0
  const per100 = per100For(food, state)
  const addedFat = fatUsed
    ? makeAddedFat(foodDb, fatSource, fatMeasure, Number(fatAmount.replace(',', '.')) || 0, Math.max(1, Math.round(Number(portions) || 1)))
    : undefined
  const preview = entryMacros({ per100, grams, addedFat })
  const fatMissing = food.fatPrompt && fatUsed === undefined
  const yieldG = cookedPer100Raw(food)

  function pickUnit(i: number) {
    setUnitIdx(i)
    const u = allUnits[i]
    if (u.state) setState(u.state)
  }

  function save() {
    onSave({
      meal: entry?.meal ?? meal,
      foodKey: food.key,
      name: food.name,
      state,
      grams: Math.round(grams * 10) / 10,
      measure: unit ? { label: unit.label, count } : undefined,
      per100,
      addedFat,
    })
  }

  const visibleUnits = hands
    ? allUnits.map((u, i) => ({ u, i }))
    : allUnits.map((u, i) => ({ u, i })).filter(({ u }) => !u.state || u.state === state)

  return (
    <div className="card stack-sm food-editor">
      <div className="spread">
        <strong>{food.name}</strong>
        {food.source === 'usda' && <span className="badge">USDA · en inglés</span>}
        {food.source === 'recipe' && <span className="badge">Preparación estimada</span>}
      </div>

      {food.raw && food.cooked && !food.recipe && (
        <div className="row">
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            Pesado en
          </span>
          <div className="chips">
            {(['raw', 'cooked'] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={`chip${state === s ? ' on' : ''}`}
                onClick={() => {
                  setState(s)
                  if (unit?.state && unit.state !== s) setUnitIdx(-1)
                }}
              >
                {s === 'raw' ? 'Crudo' : 'Cocido'}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="row" style={{ alignItems: 'flex-end' }}>
        {(!hands || unitIdx < 0) && (
          <label className="field" style={{ width: 130 }}>
            Gramos
            <input
              type="number"
              inputMode="decimal"
              value={unit ? '' : gramsText}
              placeholder={unit ? `${fmtNum(Math.round(grams))} g` : ''}
              onChange={(e) => {
                setUnitIdx(-1)
                setGramsText(e.target.value)
              }}
              autoFocus={!hands}
            />
          </label>
        )}
        {unit && (
          <label className="field" style={{ width: 110 }}>
            Cantidad
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {fmtNum(n)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {visibleUnits.length > 0 && (
        <div className="chips">
          {visibleUnits.map(({ u, i }) => (
            <button
              key={i}
              type="button"
              className={`chip${unitIdx === i ? ' on' : ''}`}
              onClick={() => pickUnit(i)}
              title={`${u.grams} g`}
            >
              {u.hand ? '✋ ' : ''}
              {u.label}
              {u.state && food.raw && food.cooked && !food.recipe ? ` (${u.state === 'raw' ? 'crudo' : 'cocido'})` : ''}
            </button>
          ))}
          {hands && unitIdx >= 0 && (
            <button type="button" className="chip" onClick={() => setUnitIdx(-1)}>
              En gramos
            </button>
          )}
        </div>
      )}
      {unit?.hand && (
        <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>
          {unit.label === 'Palma' && 'Palma: el tamaño y grosor de tu palma, sin dedos (~100 g cocido).'}
          {unit.label === 'Puño' && 'Puño: el volumen de tu puño cerrado (~1 taza).'}
          {unit.label === 'Pulgar' && 'Pulgar: el tamaño de tu pulgar completo (~1 cucharada).'} Es una estimación: varía con el tamaño de
          la mano.
        </p>
      )}

      {yieldG && grams > 0 && (
        <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>
          {state === 'raw'
            ? `${fmtNum(Math.round(grams))} g crudos ≈ ${Math.round((grams * yieldG) / 100)} g cocidos.`
            : `${fmtNum(Math.round(grams))} g cocidos ≈ ${Math.round((grams * 100) / yieldG)} g crudos.`}{' '}
          Si pesas, hazlo siempre del mismo modo.
        </p>
      )}
      {food.recipe && (
        <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>
          Valor estimado con una receta típica (incluye su aceite). Puede variar mucho según cómo se prepare.
        </p>
      )}

      {fatOpen ? (
        <div className="stack-sm fat-box">
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>¿Se usó aceite, mantequilla o grasa para prepararlo?</span>
          <div className="chips">
            <button type="button" className={`chip${fatUsed === false ? ' on' : ''}`} onClick={() => setFatUsed(false)}>
              No, sin grasa
            </button>
            <button type="button" className={`chip${fatUsed ? ' on' : ''}`} onClick={() => setFatUsed(true)}>
              Sí
            </button>
          </div>
          {fatUsed && (
            <>
              <div className="row" style={{ alignItems: 'flex-end' }}>
                <label className="field" style={{ flex: '1 1 160px' }}>
                  Grasa
                  <select value={fatSource} onChange={(e) => setFatSource(e.target.value)}>
                    {FAT_SOURCES.map((k) => (
                      <option key={k} value={k}>
                        {foodDb.byKey.get(k)?.name ?? k}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field" style={{ width: 80 }}>
                  Cantidad
                  <input type="number" inputMode="decimal" value={fatAmount} onChange={(e) => setFatAmount(e.target.value)} />
                </label>
                <label className="field" style={{ width: 140 }}>
                  Medida
                  <select value={fatMeasure} onChange={(e) => setFatMeasure(e.target.value as FatMeasure)}>
                    {FAT_MEASURES.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field" style={{ width: 110 }}>
                  Porciones
                  <input type="number" inputMode="numeric" min={1} value={portions} onChange={(e) => setPortions(e.target.value)} />
                </label>
              </div>
              <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>
                Si cocinaste para varias personas, pon cuántas porciones salieron: por ejemplo, 1 cucharada de aceite en un arroz para 5
                porciones le deja a tu plato 1/5.{' '}
                {addedFat && `A tu porción: ${fmtNum(addedFat.grams)} g (${r0(scale(addedFat.per100, addedFat.grams).kcal)} kcal).`}
              </p>
            </>
          )}
          {food.fatPrompt && fatUsed === undefined && (
            <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>
              La grasa de cocción es lo que más se olvida: 1 cucharada de aceite son ~120 kcal.
            </p>
          )}
        </div>
      ) : (
        <button type="button" className="btn small" style={{ alignSelf: 'flex-start' }} onClick={() => setFatOpen(true)}>
          + Aceite o grasa de cocción
        </button>
      )}

      <div className="spread">
        <span>
          <strong>{r0(preview.kcal)} kcal</strong> <MacroLine m={preview} />
        </span>
        <div className="row">
          <button type="button" className="btn small" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="btn small primary" disabled={grams <= 0 || fatMissing} onClick={save}>
            {entry ? 'Guardar' : 'Agregar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Producto propio (tabla nutricional del empaque) -----------------------------------------------

function CustomFoodForm({
  profileId,
  initialName,
  onCreated,
  onCancel,
}: {
  profileId: string
  initialName: string
  onCreated: (f: CustomFood) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initialName)
  const [brand, setBrand] = useState('')
  const [basis, setBasis] = useState<'100' | 'portion'>('portion')
  const [portionG, setPortionG] = useState('')
  const [portionLabel, setPortionLabel] = useState('')
  const [v, setV] = useState({ kcal: '', p: '', f: '', c: '', fib: '' })
  const num = (s: string) => Number(s.replace(',', '.')) || 0
  const base = basis === '100' ? 100 : num(portionG)
  const valid = name.trim() !== '' && base > 0 && v.kcal !== ''

  async function save() {
    const k = 100 / base
    const food: CustomFood = {
      id: crypto.randomUUID(),
      profileId,
      name: name.trim(),
      brand: brand.trim() || undefined,
      per100: {
        kcal: num(v.kcal) * k,
        p: num(v.p) * k,
        f: num(v.f) * k,
        c: num(v.c) * k,
        fib: num(v.fib) * k,
      },
      portion: num(portionG) > 0 ? { label: portionLabel.trim() || 'Porción', grams: num(portionG) } : undefined,
      createdAt: new Date().toISOString(),
    }
    await db.customFoods.put(food)
    onCreated(food)
  }

  const field = (key: keyof typeof v, label: string) => (
    <label className="field">
      {label}
      <input type="number" inputMode="decimal" value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} />
    </label>
  )

  return (
    <div className="card stack-sm food-editor">
      <strong>Nuevo producto</strong>
      <p className="muted" style={{ fontSize: '0.85rem', margin: 0 }}>
        Copia la tabla nutricional del empaque (sirve para marcas de tienda como D1 o Ara). Queda guardado para la próxima vez.
      </p>
      <div className="grid-tight">
        <label className="field">
          Nombre
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Queso campesino" />
        </label>
        <label className="field">
          Marca o tienda (opcional)
          <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="D1" />
        </label>
      </div>
      <div className="row">
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          Los valores de la etiqueta son
        </span>
        <div className="chips">
          <button type="button" className={`chip${basis === 'portion' ? ' on' : ''}`} onClick={() => setBasis('portion')}>
            Por porción
          </button>
          <button type="button" className={`chip${basis === '100' ? ' on' : ''}`} onClick={() => setBasis('100')}>
            Por 100 g o 100 ml
          </button>
        </div>
      </div>
      <div className="grid-tight">
        <label className="field">
          Tamaño de porción (g o ml){basis === '100' && ' — opcional'}
          <input type="number" inputMode="decimal" value={portionG} onChange={(e) => setPortionG(e.target.value)} />
        </label>
        <label className="field">
          Nombre de la porción (opcional)
          <input value={portionLabel} onChange={(e) => setPortionLabel(e.target.value)} placeholder="2 galletas, 1 tajada…" />
        </label>
      </div>
      <div className="grid-tight">
        {field('kcal', 'Calorías (kcal)')}
        {field('p', 'Proteína (g)')}
        {field('f', 'Grasa total (g)')}
        {field('c', 'Carbohidratos (g)')}
        {field('fib', 'Fibra (g, opcional)')}
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn small" onClick={onCancel}>
          Cancelar
        </button>
        <button type="button" className="btn small primary" disabled={!valid} onClick={save}>
          Guardar producto
        </button>
      </div>
    </div>
  )
}

// --- Buscador ----------------------------------------------------------------------------------------

function FoodPicker({
  foods,
  recents,
  onPick,
  onCreate,
  onCancel,
}: {
  foods: Food[]
  recents: Food[]
  onPick: (f: Food) => void
  onCreate: (name: string) => void
  onCancel: () => void
}) {
  const [q, setQ] = useState('')
  const results = useMemo(() => searchFoods(foods, q), [foods, q])
  return (
    <div className="card stack-sm food-editor">
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input autoFocus placeholder="Buscar: arroz, pechuga, arepa, lomo de cerdo…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="btn small" onClick={onCancel}>
          Cerrar
        </button>
      </div>
      {q.trim().length < 2 ? (
        recents.length > 0 && (
          <>
            <span className="muted" style={{ fontSize: '0.8rem' }}>
              Recientes
            </span>
            <div className="chips">
              {recents.map((f) => (
                <button key={f.key} type="button" className="chip" onClick={() => onPick(f)}>
                  {f.name}
                </button>
              ))}
            </div>
          </>
        )
      ) : (
        <div className="food-results">
          {results.map((f) => {
            const m = f.raw ?? f.cooked!
            return (
              <button key={f.key} type="button" className="food-result" onClick={() => onPick(f)}>
                <span>
                  {f.name}
                  <span className="muted" style={{ fontSize: '0.75rem' }}>
                    {' '}
                    · {f.source === 'usda' ? 'USDA' : f.group}
                  </span>
                </span>
                <span className="muted" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                  {r0(m.kcal)} kcal/100 g{f.raw && f.cooked && !f.recipe ? ' crudo' : ''}
                </span>
              </button>
            )
          })}
          {results.length === 0 && <p className="muted">Sin resultados. Prueba con otra palabra o agrégalo con su etiqueta.</p>}
        </div>
      )}
      <button type="button" className="btn small" style={{ alignSelf: 'flex-start' }} onClick={() => onCreate(q.trim())}>
        + Producto con tabla nutricional (marca, tienda…)
      </button>
    </div>
  )
}

// --- Diario --------------------------------------------------------------------------------------------

type Panel =
  { meal: MealSlot; step: 'search' } | { meal: MealSlot; step: 'custom'; name: string } | { meal: MealSlot; step: 'edit'; draft: Draft }

export function FoodDiary({ profile, targets, meals }: { profile: Profile; targets: DayTargets; meals: number }) {
  const { db: foodDb, error } = useFoodDb()
  const [date, setDate] = useState(todayISO())
  const [panel, setPanel] = useState<Panel>()
  const hands = profile.foodMode === 'hands'

  const entries = useLiveQuery(() => db.foodLogs.where('[profileId+date]').equals([profile.id, date]).toArray(), [profile.id, date])
  const history = useLiveQuery(() => db.foodLogs.where('profileId').equals(profile.id).toArray(), [profile.id])
  const customs = useLiveQuery(() => db.customFoods.where('profileId').equals(profile.id).toArray(), [profile.id])

  const customFoods = useMemo(() => (customs ?? []).map(customToFood), [customs])
  const allFoods = useMemo(() => [...customFoods, ...(foodDb?.foods ?? [])], [customFoods, foodDb])
  const byKey = useMemo(() => new Map(allFoods.map((f) => [f.key, f])), [allFoods])
  const groups = useMemo(() => new Map(allFoods.map((f) => [f.key, f.group])), [allFoods])

  const sortedHistory = useMemo(() => [...(history ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [history])
  const recents = useMemo(() => {
    const seen = new Set<string>()
    const out: Food[] = []
    for (const e of sortedHistory) {
      if (seen.has(e.foodKey)) continue
      seen.add(e.foodKey)
      const f = byKey.get(e.foodKey)
      if (f) out.push(f)
      if (out.length >= 14) break
    }
    return out
  }, [sortedHistory, byKey])

  if (error) return <div className="alert warn">{error}</div>
  if (!foodDb || !entries) return <div className="card empty">Cargando alimentos…</div>

  const day = totals(entries)
  const complete = date < todayISO()
  const feedback = dayFeedback(day, targets, entries, groups, complete)

  async function saveEntry(data: Omit<FoodLog, 'id' | 'profileId' | 'date' | 'createdAt'>, existing?: FoodLog) {
    await db.foodLogs.put({
      ...data,
      id: existing?.id ?? crypto.randomUUID(),
      profileId: profile.id,
      date: existing?.date ?? date,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    })
    setPanel(undefined)
  }

  async function copyPreviousDay() {
    const prev = await db.foodLogs
      .where('[profileId+date]')
      .equals([profile.id, addDays(date, -1)])
      .toArray()
    if (prev.length === 0) {
      alert('El día anterior no tiene registros.')
      return
    }
    const now = new Date().toISOString()
    await db.foodLogs.bulkPut(
      prev.map((e) => ({
        ...e,
        id: crypto.randomUUID(),
        date,
        createdAt: now,
      })),
    )
  }

  const palmsPerMeal = Math.max(1, Math.round((targets.proteinG / meals / PALM_PROTEIN_G) * 2) / 2)
  const fistsPerMeal = Math.max(0.5, Math.round((targets.carbsG / meals / 42) * 2) / 2)
  const thumbsPerMeal = Math.max(0.5, Math.round(((targets.fatG * 0.5) / meals / 14) * 2) / 2)

  return (
    <div className="stack">
      <div className="spread">
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <button type="button" className="btn small" aria-label="Día anterior" onClick={() => setDate(addDays(date, -1))}>
            ‹
          </button>
          <strong
            style={{
              minWidth: 120,
              textAlign: 'center',
              textTransform: 'capitalize',
            }}
          >
            {dateLabel(date)}
          </strong>
          <button
            type="button"
            className="btn small"
            aria-label="Día siguiente"
            disabled={date >= todayISO()}
            onClick={() => setDate(addDays(date, 1))}
          >
            ›
          </button>
        </div>
        <div className="chips" role="group" aria-label="Modo de registro">
          <button
            type="button"
            className={`chip${!hands ? ' on' : ''}`}
            onClick={() =>
              db.profiles.update(profile.id, {
                foodMode: 'precise',
                updatedAt: new Date().toISOString(),
              })
            }
          >
            Con báscula
          </button>
          <button
            type="button"
            className={`chip${hands ? ' on' : ''}`}
            onClick={() =>
              db.profiles.update(profile.id, {
                foodMode: 'hands',
                updatedAt: new Date().toISOString(),
              })
            }
          >
            Sin báscula
          </button>
        </div>
      </div>

      <div className="card stack-sm">
        <div className="spread">
          <div className="stat">
            <span className="label">Calorías del día</span>
            <span className="value">
              {r0(day.kcal).toLocaleString('es')}{' '}
              <span className="muted" style={{ fontSize: '1rem' }}>
                / {targets.kcal.toLocaleString('es')}
              </span>
            </span>
          </div>
          <span className="muted" style={{ fontSize: '0.85rem' }}>
            {day.kcal <= targets.kcal
              ? `Quedan ${r0(targets.kcal - day.kcal).toLocaleString('es')} kcal`
              : `${r0(day.kcal - targets.kcal).toLocaleString('es')} kcal por encima`}
          </span>
        </div>
        <div className={`bar${day.kcal > targets.kcal * 1.1 ? ' warn' : ''}`}>
          <span
            style={{
              width: `${Math.min(100, (day.kcal / targets.kcal) * 100)}%`,
            }}
          />
        </div>
        <div className="grid-tight">
          <Progress label="Proteína" value={day.p} target={targets.proteinG} unit="g" />
          <Progress label="Grasas" value={day.f} target={targets.fatG} unit="g" />
          <Progress label="Carbohidratos" value={day.c} target={targets.carbsG} unit="g" />
        </div>
        <span className="muted" style={{ fontSize: '0.8rem' }}>
          Fibra: {r0(day.fib)} g (meta orientativa: 25–35 g)
        </span>
      </div>

      {hands && (
        <div className="alert info">
          <strong>Tu plato en cada comida ({meals} al día):</strong> {fmtNum(palmsPerMeal)} palma{palmsPerMeal === 1 ? '' : 's'} de
          proteína, {fmtNum(fistsPerMeal)} puño{fistsPerMeal === 1 ? '' : 's'} de arroz, papa, plátano o granos, 1–2 puños de verduras y{' '}
          {fmtNum(thumbsPerMeal)} pulgar{thumbsPerMeal === 1 ? '' : 'es'} de grasa (aceite, aguacate, queso). Ajusta según cómo cambie tu
          peso.
        </div>
      )}

      {feedback.length > 0 && (
        <div className="stack-sm">
          {feedback.map((f) => (
            <div key={f.text} className={`alert ${f.tone === 'ok' ? 'info' : f.tone === 'warn' ? 'warn' : 'info'}`}>
              {f.tone === 'ok' ? '✓ ' : ''}
              {f.text}
            </div>
          ))}
        </div>
      )}

      {MEALS.map((m) => {
        const items = entries.filter((e) => e.meal === m.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        const mt = totals(items)
        const open = panel?.meal === m.id
        return (
          <div key={m.id} className="card stack-sm">
            <div className="spread">
              <h2 style={{ margin: 0 }}>{m.label}</h2>
              <span className="muted" style={{ fontSize: '0.85rem' }}>
                {items.length > 0 ? `${r0(mt.kcal)} kcal · P ${r0(mt.p)} g` : ''}
              </span>
            </div>
            {items.map((e) => {
              const em = entryMacros(e)
              const editing = panel?.step === 'edit' && panel.draft.entry?.id === e.id
              if (editing) return null
              return (
                <div key={e.id} className="food-entry">
                  <button
                    type="button"
                    className="food-entry-main"
                    onClick={() =>
                      setPanel({
                        meal: m.id,
                        step: 'edit',
                        draft: {
                          food: byKey.get(e.foodKey) ?? foodFromEntry(e),
                          entry: e,
                        },
                      })
                    }
                  >
                    <span>
                      {e.name}
                      <span className="muted" style={{ fontSize: '0.8rem' }}>
                        {' '}
                        ·{' '}
                        {amountText(e, byKey.get(e.foodKey))}
                        {e.addedFat ? ` + ${e.addedFat.name.split(' (')[0].toLowerCase()}: ${e.addedFat.note}` : ''}
                      </span>
                    </span>
                    <span style={{ whiteSpace: 'nowrap' }}>
                      {r0(em.kcal)} kcal <MacroLine m={em} />
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn small danger"
                    aria-label={`Eliminar ${e.name}`}
                    onClick={() => db.foodLogs.delete(e.id)}
                  >
                    ✕
                  </button>
                </div>
              )
            })}
            {open && panel.step === 'search' && (
              <FoodPicker
                foods={allFoods}
                recents={recents}
                onPick={(food) => setPanel({ meal: m.id, step: 'edit', draft: { food } })}
                onCreate={(name) => setPanel({ meal: m.id, step: 'custom', name })}
                onCancel={() => setPanel(undefined)}
              />
            )}
            {open && panel.step === 'custom' && (
              <CustomFoodForm
                profileId={profile.id}
                initialName={panel.name}
                onCreated={(c) =>
                  setPanel({
                    meal: m.id,
                    step: 'edit',
                    draft: { food: customToFood(c) },
                  })
                }
                onCancel={() => setPanel({ meal: m.id, step: 'search' })}
              />
            )}
            {open && panel.step === 'edit' && (
              <EntryEditor
                key={panel.draft.entry?.id ?? panel.draft.food.key}
                draft={panel.draft}
                db={foodDb}
                last={sortedHistory.find((e) => e.foodKey === panel.draft.food.key)}
                meal={m.id}
                hands={hands}
                onSave={(data) => saveEntry(data, panel.draft.entry)}
                onCancel={() => setPanel(undefined)}
              />
            )}
            {!open && (
              <button
                type="button"
                className="btn small"
                style={{ alignSelf: 'flex-start' }}
                onClick={() => setPanel({ meal: m.id, step: 'search' })}
              >
                + Agregar
              </button>
            )}
          </div>
        )
      })}

      <div className="row">
        <button type="button" className="btn small" onClick={copyPreviousDay}>
          Copiar lo del día anterior
        </button>
      </div>
      <p className="muted" style={{ fontSize: '0.8rem' }}>
        Valores de USDA FoodData Central (dominio público) con nombres y cortes colombianos; las preparaciones y algunas frutas son
        estimaciones. Los registros guardan los valores del momento, así que no cambian si la base se actualiza.
      </p>
    </div>
  )
}
