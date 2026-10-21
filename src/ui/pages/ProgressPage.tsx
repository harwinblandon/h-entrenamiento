import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { activePlan, db } from '../../db/db'
import { getExercise, isLoadless } from '../../domain/exercises'
import { MUSCLE_LABELS } from '../../domain/labels'
import {
  adherence,
  exerciseHistory,
  loggedExercises,
  personalRecords,
  waistSeries,
  weeklyMuscleSets,
  weightSeries,
} from '../../domain/progress'
import { nextSession, weightTrend } from '../../domain/schedule'
import type { BodyLog, LoggedSet, Plan, WorkoutLog } from '../../domain/types'
import { MUSCLES } from '../../domain/types'
import { useActiveProfile } from '../activeProfile'
import { TimeChart } from '../components/TimeChart'

type Range = 30 | 90 | 0
const RANGES: { value: Range; label: string }[] = [
  { value: 30, label: 'Últimos 30 días' },
  { value: 90, label: 'Últimos 90 días' },
  { value: 0, label: 'Todo' },
]

const toT = (date: string) => Date.parse(`${date.slice(0, 10)}T12:00:00`)
const fmtKg = (n: number) => `${Number(n.toFixed(1))} kg`
const fmtDate = (date: string) => new Date(toT(date)).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtSet = (s: LoggedSet) => `${s.weight > 0 ? `${Number(s.weight.toFixed(2))} kg × ` : ''}${s.reps} reps · RIR ${s.rir}`

function inRange(date: string, range: Range) {
  return range === 0 || Date.now() - toT(date) <= range * 86_400_000
}

function WeightCard({ logs, range }: { logs: BodyLog[]; range: Range }) {
  const pts = weightSeries(logs).filter((p) => inRange(p.date, range))
  const trend = weightTrend(logs)
  return (
    <div className="card stack-sm">
      <div className="spread">
        <h2 style={{ margin: 0 }}>Peso corporal</h2>
        {trend.changePct !== undefined && (
          <span className="badge">
            {trend.changePct >= 0 ? '+' : ''}
            {trend.changePct.toFixed(2)} % vs semana anterior
          </span>
        )}
      </div>
      {pts.length === 0 ? (
        <p className="muted">Sin pesajes en este periodo. Regístralos desde el Panel.</p>
      ) : (
        <>
          <TimeChart
            ariaLabel="Peso diario y promedio de 7 días"
            formatY={(v) => `${Number(v.toFixed(1))}`}
            series={[
              { id: 'avg', label: 'Promedio 7 días', kind: 'line', tone: 'primary', points: pts.map((p) => ({ t: toT(p.date), y: p.avg })) },
              { id: 'daily', label: 'Pesaje diario', kind: 'dots', tone: 'secondary', points: pts.map((p) => ({ t: toT(p.date), y: p.weight })) },
            ]}
          />
          <details className="table-toggle">
            <summary>Ver tabla</summary>
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th className="r">Peso</th>
                  <th className="r">Promedio 7 días</th>
                </tr>
              </thead>
              <tbody>
                {[...pts].reverse().map((p) => (
                  <tr key={p.date}>
                    <td>{fmtDate(p.date)}</td>
                    <td className="r">{fmtKg(p.weight)}</td>
                    <td className="r">{fmtKg(p.avg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </div>
  )
}

function WaistCard({ logs, range }: { logs: BodyLog[]; range: Range }) {
  const pts = waistSeries(logs).filter((p) => inRange(p.date, range))
  return (
    <div className="card stack-sm">
      <h2>Cintura</h2>
      {pts.length === 0 ? (
        <p className="muted">Sin medidas de cintura en este periodo. Mídela una vez por semana desde el Panel.</p>
      ) : (
        <>
          <TimeChart
            ariaLabel="Perímetro de cintura"
            formatY={(v) => `${Number(v.toFixed(1))}`}
            series={[{ id: 'waist', label: 'Cintura (cm)', kind: 'line', tone: 'primary', points: pts.map((p) => ({ t: toT(p.date), y: p.waist })) }]}
          />
          <details className="table-toggle">
            <summary>Ver tabla</summary>
            <table>
              <tbody>
                {[...pts].reverse().map((p) => (
                  <tr key={p.date}>
                    <td>{fmtDate(p.date)}</td>
                    <td className="r">{p.waist} cm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </div>
  )
}

function StrengthCard({ logs, range }: { logs: WorkoutLog[]; range: Range }) {
  const options = loggedExercises(logs)
  const [selected, setSelected] = useState<string>()
  const id = selected && options.some((o) => o.id === selected) ? selected : options[0]?.id

  if (!id) {
    return (
      <div className="card stack-sm">
        <h2>Rendimiento por ejercicio</h2>
        <p className="muted">Aparecerá cuando termines tu primera sesión.</p>
      </div>
    )
  }

  const ex = getExercise(id)
  const loadless = isLoadless(ex)
  const all = exerciseHistory(logs, id)
  const hist = all.filter((h) => inRange(h.date, range))
  const metric = (h: (typeof all)[number]) => (loadless ? h.best.reps : h.e1rm)
  const first = all[0]
  const latest = all[all.length - 1]
  const best = all.reduce((b, h) => (metric(h) > metric(b) ? h : b), all[0])
  const change = first && latest && metric(first) > 0 ? ((metric(latest) - metric(first)) / metric(first)) * 100 : undefined
  const unit = loadless ? 'reps' : 'kg'

  return (
    <div className="card stack-sm">
      <div className="spread">
        <h2 style={{ margin: 0 }}>Rendimiento por ejercicio</h2>
        <select value={id} onChange={(e) => setSelected(e.target.value)} style={{ width: 'auto', maxWidth: '100%' }} aria-label="Ejercicio">
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.sessions})
            </option>
          ))}
        </select>
      </div>
      <div className="grid-tight">
        <div className="stat">
          <span className="label">{loadless ? 'Mejores reps (última)' : '1RM estimado (última)'}</span>
          <span className="value">
            {metric(latest)} {unit}
          </span>
          <span className="sub">{fmtSet(latest.best)}</span>
        </div>
        <div className="stat">
          <span className="label">Cambio desde el inicio</span>
          <span className="value">{change === undefined || all.length < 2 ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(1)} %`}</span>
          <span className="sub">{all.length} sesiones registradas</span>
        </div>
        <div className="stat">
          <span className="label">Mejor marca</span>
          <span className="value">
            {metric(best)} {unit}
          </span>
          <span className="sub">{fmtDate(best.date)}</span>
        </div>
      </div>
      {hist.length === 0 ? (
        <p className="muted">Sin sesiones de este ejercicio en el periodo elegido.</p>
      ) : (
        <TimeChart
          ariaLabel={`${loadless ? 'Repeticiones' : '1RM estimado'} en ${ex.name}`}
          formatY={(v) => `${Number(v.toFixed(1))}`}
          series={[
            {
              id: 'metric',
              label: loadless ? 'Repeticiones de la mejor serie' : '1RM estimado (kg)',
              kind: 'line',
              tone: 'primary',
              points: hist.map((h) => ({ t: toT(h.date), y: metric(h) })),
            },
          ]}
        />
      )}
      <small>
        {loadless
          ? 'Sin carga externa: se compara la mejor serie por repeticiones.'
          : '1RM estimado a partir de peso, repeticiones y RIR de la mejor serie con técnica estable. Permite comparar sesiones con cargas distintas.'}
      </small>
      {hist.length > 0 && (
        <details className="table-toggle">
          <summary>Ver tabla</summary>
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Mejor serie</th>
                <th className="r">{loadless ? 'Reps' : '1RM est.'}</th>
              </tr>
            </thead>
            <tbody>
              {[...hist].reverse().map((h) => (
                <tr key={h.date + h.e1rm}>
                  <td>{fmtDate(h.date)}</td>
                  <td>{fmtSet(h.best)}</td>
                  <td className="r">{metric(h)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  )
}

function WeeklySetsCard({ plan, logs }: { plan: Plan; logs: WorkoutLog[] }) {
  const current = nextSession(plan, logs)?.week ?? plan.weeks
  // Si la semana actual aún no tiene sesiones terminadas, se abre la anterior.
  const hasData = (w: number) => logs.some((l) => l.planId === plan.id && l.week === w && l.finishedAt)
  const [week, setWeek] = useState(!hasData(current) && current > 1 ? current - 1 : current)
  const data = weeklyMuscleSets(plan, logs, week)
  const rows = MUSCLES.filter((m) => data[m].target > 0)
  const max = Math.max(...rows.map((m) => Math.max(data[m].done, data[m].target)), 1)

  return (
    <div className="card stack-sm">
      <div className="spread">
        <h2 style={{ margin: 0 }}>Series por músculo</h2>
        <select value={week} onChange={(e) => setWeek(Number(e.target.value))} style={{ width: 'auto' }} aria-label="Semana">
          {Array.from({ length: plan.weeks }, (_, i) => i + 1).map((w) => (
            <option key={w} value={w}>
              Semana {w}
              {w === current ? ' (actual)' : ''}
            </option>
          ))}
        </select>
      </div>
      <table>
        <tbody>
          {rows.map((m) => {
            const d = data[m]
            return (
              <tr key={m} title={`${MUSCLE_LABELS[m]}: ${d.done} de ${d.target} series`}>
                <td style={{ width: '32%' }}>{MUSCLE_LABELS[m]}</td>
                <td>
                  <div className="target-bar">
                    <span style={{ width: `${(d.done / max) * 100}%` }} />
                    <i style={{ left: `calc(${(d.target / max) * 100}% - 1px)` }} />
                  </div>
                </td>
                <td className="r" style={{ width: '18%' }}>
                  {d.done} / {d.target}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <small>Barra: series efectivas hechas (directas + 0.5 × indirectas). Marca vertical: objetivo semanal del plan.</small>
    </div>
  )
}

const VISIBLE = 8

function RecordsCard({ logs }: { logs: WorkoutLog[] }) {
  const [showAll, setShowAll] = useState(false)
  const order = loggedExercises(logs).map((e) => e.id)
  const all = personalRecords(logs).sort((a, b) => order.indexOf(a.exerciseId) - order.indexOf(b.exerciseId))
  const prs = showAll ? all : all.slice(0, VISIBLE)
  return (
    <div className="card stack-sm">
      <h2>Récords personales</h2>
      <small>Ordenados por los ejercicios que más haces. Solo cuentan series con técnica estable.</small>
      {prs.length === 0 ? (
        <p className="muted">Aparecerán cuando termines tu primera sesión.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Ejercicio</th>
                <th>Carga más alta</th>
                <th className="r hide-sm">Mejor 1RM est.</th>
              </tr>
            </thead>
            <tbody>
              {prs.map((r) => (
                <tr key={r.exerciseId}>
                  <td>{r.name}</td>
                  <td>
                    {r.heaviest ? fmtSet(r.heaviest.set) : `${r.mostReps.set.reps} reps`}
                    <br />
                    <small>{fmtDate((r.heaviest ?? r.mostReps).date)}</small>
                  </td>
                  <td className="r hide-sm">{r.bestE1RM ? fmtKg(r.bestE1RM.value) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {all.length > VISIBLE && (
            <button className="btn small" style={{ marginTop: '0.5rem' }} onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Ver menos' : `Ver los ${all.length - VISIBLE} restantes`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function HistoryCard({ logs, plans, range }: { logs: WorkoutLog[]; plans: Plan[]; range: Range }) {
  const [showAll, setShowAll] = useState(false)
  const allDone = logs
    .filter((l) => l.finishedAt && inRange(l.finishedAt, range))
    .sort((a, b) => b.finishedAt!.localeCompare(a.finishedAt!))
  const done = showAll ? allDone : allDone.slice(0, VISIBLE)
  const sessionName = (l: WorkoutLog) => plans.find((p) => p.id === l.planId)?.sessions[l.sessionIndex]?.name ?? 'Sesión'

  return (
    <div className="card stack-sm">
      <h2>Historial de sesiones</h2>
      {done.length === 0 && <p className="muted">Sin sesiones terminadas en este periodo.</p>}
      {done.map((l) => {
        const sets = l.entries.reduce((n, e) => n + e.sets.length, 0)
        const planned = l.entries.reduce((n, e) => n + e.plannedSets, 0)
        const tonnage = l.entries.reduce((n, e) => n + e.sets.reduce((t, s) => t + s.weight * s.reps, 0), 0)
        return (
          <details className="exercise" key={l.id}>
            <summary>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {sessionName(l)} <small>· semana {l.week}</small>
                </div>
                <small>
                  {fmtDate(l.finishedAt!)} · {sets}/{planned} series · {Math.round(tonnage).toLocaleString('es')} kg movidos
                  {l.fatigue !== undefined && ` · fatiga ${l.fatigue}/5`}
                </small>
              </div>
            </summary>
            <div className="exercise-body">
              {l.entries
                .filter((e) => e.sets.length > 0)
                .map((e, i) => (
                  <div key={i}>
                    <strong style={{ fontSize: '0.9rem' }}>{getExercise(e.exerciseId).name}</strong>
                    <div className="muted num" style={{ fontSize: '0.85rem' }}>
                      {e.sets.map((s, j) => (
                        <div key={j}>
                          {j + 1}. {fmtSet(s)}
                          {s.pain > 0 && ` · dolor ${s.pain}`}
                          {s.technique === 'deteriorated' && ' · técnica deteriorada'}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              {l.notes && <small>Notas: {l.notes}</small>}
            </div>
          </details>
        )
      })}
      {allDone.length > VISIBLE && (
        <button className="btn small" style={{ alignSelf: 'flex-start' }} onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Ver menos' : `Ver ${allDone.length - VISIBLE} sesiones más`}
        </button>
      )}
    </div>
  )
}

export function ProgressPage() {
  const { active } = useActiveProfile()
  const [range, setRange] = useState<Range>(90)
  const plan = useLiveQuery(async () => (active ? ((await activePlan(active.id)) ?? null) : null), [active?.id])
  const plans = useLiveQuery(() => (active ? db.plans.where('profileId').equals(active.id).toArray() : []), [active?.id])
  const logs = useLiveQuery(() => (active ? db.workouts.where('profileId').equals(active.id).toArray() : []), [active?.id])
  const bodyLogs = useLiveQuery(() => (active ? db.bodyLogs.where('profileId').equals(active.id).toArray() : []), [active?.id])

  if (!active) return <div className="card empty">Primero crea o selecciona una persona.</div>
  if (plan === undefined || !plans || !logs || !bodyLogs) return <div className="empty">Cargando…</div>

  const adh = plan ? adherence(plan, logs) : undefined
  const trend = weightTrend(bodyLogs)

  return (
    <div className="stack">
      <h1>Progreso de {active.name}</h1>

      <div className="filters" role="group" aria-label="Periodo">
        {RANGES.map((r) => (
          <button key={r.value} type="button" className={`chip ${range === r.value ? 'on' : ''}`} aria-pressed={range === r.value} onClick={() => setRange(r.value)}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="card grid-tight">
        <div className="stat">
          <span className="label">Sesiones del mesociclo</span>
          <span className="value">{adh ? `${adh.sessionsDone} / ${adh.sessionsTotal}` : '—'}</span>
          <span className="sub">{plan ? `${plan.weeks} semanas` : 'Sin mesociclo activo'}</span>
        </div>
        <div className="stat">
          <span className="label">Series completadas</span>
          <span className="value">{adh?.setCompliancePct !== undefined ? `${adh.setCompliancePct} %` : '—'}</span>
          <span className="sub">Promedio por sesión</span>
        </div>
        <div className="stat">
          <span className="label">Fatiga media</span>
          <span className="value">{adh?.avgFatigue !== undefined ? `${adh.avgFatigue} / 5` : '—'}</span>
          <span className="sub">Al terminar cada sesión</span>
        </div>
        <div className="stat">
          <span className="label">Peso promedio 7 días</span>
          <span className="value">{trend.current !== undefined ? fmtKg(trend.current) : '—'}</span>
          <span className="sub">{trend.entries} pesajes registrados</span>
        </div>
      </div>

      {logs.filter((l) => l.finishedAt).length === 0 && (
        <div className="alert info">
          Todavía no hay sesiones terminadas. Las gráficas de rendimiento, récords e historial se llenan a medida que
          entrenes. <Link to="/entrenar">Ir a entrenar</Link>
        </div>
      )}

      <div className="cols-2">
        <WeightCard logs={bodyLogs} range={range} />
        <WaistCard logs={bodyLogs} range={range} />
      </div>

      <div className="cols-2">
        <StrengthCard logs={logs} range={range} />
        {plan ? <WeeklySetsCard plan={plan} logs={logs} /> : <div className="card muted">Genera un mesociclo para ver las series por músculo.</div>}
      </div>

      <div className="cols-2">
        <HistoryCard logs={logs} plans={plans} range={range} />
        <RecordsCard logs={logs} />
      </div>
    </div>
  )
}
