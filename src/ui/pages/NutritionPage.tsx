import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { db } from '../../db/db'
import { GOAL_LABELS } from '../../domain/labels'
import { computeNutrition } from '../../domain/nutrition'
import { WEIGHINS_TO_CONFIRM, weightStatus, type WeightStatus } from '../../domain/schedule'
import type { Goal } from '../../domain/types'
import { useActiveProfile } from '../activeProfile'
import { Explanations } from '../components/Explanations'

function weightSourceText(ws: WeightStatus): string {
  if (ws.source === 'average') return `Promedio de ${ws.recentCount} pesajes de esta semana`
  if (ws.source === 'latest') return ws.daysAgo === 0 ? 'Pesaje de hoy' : `Último pesaje, hace ${ws.daysAgo} días`
  return 'Dato de la ficha, sin confirmar'
}

export function NutritionPage() {
  const { active } = useActiveProfile()
  const bodyLogs = useLiveQuery(() => (active ? db.bodyLogs.where('profileId').equals(active.id).toArray() : []), [active?.id])

  if (!active) return <div className="card empty">Primero crea o selecciona una persona.</div>

  const ws = weightStatus(bodyLogs ?? [], active.weightKg)
  const weight = ws.weightKg
  const n = computeNutrition(active, weight)

  if (n.hidden) {
    return (
      <div className="stack">
        <h1>Nutrición</h1>
        <div className="alert warn">
          El cálculo de calorías está oculto porque la ficha indica antecedentes de trastornos de la conducta alimentaria.
          Te recomendamos definir la alimentación con profesionales en nutrición y salud mental. Puedes cambiarlo en la{' '}
          <Link to={`/personas/${active.id}`}>ficha</Link>.
        </div>
      </div>
    )
  }

  const kcal = (g: number, perG: number) => Math.round(((g * perG) / n.targetKcal) * 100)
  const rateKg = n.weeklyRatePct.map((p) => Math.round(((weight * p) / 100) * 100) / 100)

  return (
    <div className="stack">
      <div className="spread">
        <h1>Nutrición de {active.name}</h1>
        <select
          aria-label="Objetivo"
          value={active.goal}
          onChange={(e) => db.profiles.update(active.id, { goal: e.target.value as Goal, updatedAt: new Date().toISOString() })}
          style={{ width: 'auto' }}
        >
          {Object.entries(GOAL_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {!ws.confirmed && (
        <div className="alert warn">
          <strong>Peso sin confirmar.</strong> Los números usan {weight} kg ({weightSourceText(ws).toLowerCase()}). Pésate en ayunas
          al menos {WEIGHINS_TO_CONFIRM} días esta semana desde el <Link to="/">Panel</Link> ({ws.recentCount}/{WEIGHINS_TO_CONFIRM}); el
          cálculo pasará a usar tu promedio semanal.
        </div>
      )}
      {n.warnings.map((w) => (
        <div className="alert warn" key={w}>
          {w}
        </div>
      ))}

      <div className="cols-2">
        <div className="stack">
          <div className="card grid-tight">
            <div className="stat">
              <span className="label">Calorías objetivo</span>
              <span className="value">{n.targetKcal.toLocaleString('es')} kcal</span>
              <span className="sub">
                {n.adjustmentPct === 0 ? 'Mantenimiento' : `${n.adjustmentPct > 0 ? '+' : ''}${Math.round(n.adjustmentPct * 100)} % sobre el gasto`}
              </span>
            </div>
            <div className="stat">
              <span className="label">Gasto estimado</span>
              <span className="value">{n.tdee.toLocaleString('es')} kcal</span>
              <span className="sub">
                Rango probable {n.tdeeRange[0].toLocaleString('es')}–{n.tdeeRange[1].toLocaleString('es')}
              </span>
            </div>
            <div className="stat">
              <span className="label">Ritmo buscado</span>
              <span className="value">
                {rateKg[0]} a {rateKg[1]} kg
              </span>
              <span className="sub">
                por semana ({n.weeklyRatePct[0]} a {n.weeklyRatePct[1]} % del peso)
              </span>
            </div>
            <div className="stat">
              <span className="label">Peso usado</span>
              <span className="value">{weight} kg</span>
              <span className="sub">
                {weightSourceText(ws)} {ws.confirmed ? <span className="badge accent">Confirmado</span> : <span className="badge warn">Sin confirmar</span>}
              </span>
            </div>
          </div>

          <div className="grid-tight">
            <div className="card stat">
              <span className="label">Proteína</span>
              <span className="value">{n.proteinG} g</span>
              <span className="sub">
                {n.proteinPerKg} g/kg · {kcal(n.proteinG, 4)} % kcal
              </span>
            </div>
            <div className="card stat">
              <span className="label">Grasas</span>
              <span className="value">{n.fatG} g</span>
              <span className="sub">
                {n.fatPerKg} g/kg · {kcal(n.fatG, 9)} % kcal
              </span>
            </div>
            <div className="card stat">
              <span className="label">Carbohidratos</span>
              <span className="value">{n.carbsG} g</span>
              <span className="sub">
                {Math.round((n.carbsG / weight) * 10) / 10} g/kg · {kcal(n.carbsG, 4)} % kcal
              </span>
            </div>
          </div>

          <div className="card stack-sm">
            <h2>Cómo aplicarlo</h2>
            <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
              <li>{n.mealsNote}.</li>
              <li>Pésate en ayunas cada mañana y fíjate en el promedio semanal, nunca en un dato aislado.</li>
              <li>Pesa los alimentos siempre del mismo modo (crudos o cocidos) para que los registros sean consistentes.</li>
              <li>Mantén las calorías al menos 2 semanas antes de juzgar si funcionan.</li>
            </ul>
          </div>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            Punto de partida estimado, no una prescripción exacta. En esta fase tú te encargas de cumplirlo; la app ajustará las
            calorías en una fase posterior según la evolución real del peso y la cintura.
          </p>
        </div>

        <div className="card stack-sm">
          <h2>De dónde salen estos números</h2>
          <Explanations items={n.explanations} />
        </div>
      </div>
    </div>
  )
}
