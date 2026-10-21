import { useEffect } from 'react'
import { db, savePlan } from '../../db/db'
import { planChanges, planSnapshot } from '../../domain/planChanges'
import { generatePlan } from '../../domain/planGenerator'
import { evaluateSafety } from '../../domain/safety'
import type { Plan, Profile } from '../../domain/types'

export async function regeneratePlan(profile: Profile, weeks: number) {
  await savePlan({ ...generatePlan(profile, { weeks }), profileSnapshot: planSnapshot(profile) })
}

/** Avisa cuando la ficha cambió en algo que influye en el plan desde que se generó. */
export function PlanChangesAlert({ plan, profile }: { plan: Plan; profile: Profile }) {
  // Planes creados antes de existir el aviso: la ficha actual pasa a ser la referencia.
  useEffect(() => {
    if (!plan.profileSnapshot) db.plans.update(plan.id, { profileSnapshot: planSnapshot(profile) })
  }, [plan.id, plan.profileSnapshot, profile])

  const changes = planChanges(plan.profileSnapshot, profile)
  if (changes.length === 0) return null
  const canGenerate = evaluateSafety(profile.safety).canGenerate

  return (
    <div className="alert warn stack-sm">
      <div>
        <strong>Tu ficha cambió desde que se generó el plan</strong>
        <ul>
          {changes.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
      <p style={{ margin: 0, fontSize: '0.88rem' }}>
        Puedes regenerarlo ahora o mantenerlo hasta terminar el mesociclo para no perder la continuidad de cargas.
      </p>
      <div className="row">
        <button
          className="btn primary small"
          disabled={!canGenerate}
          onClick={() => {
            if (confirm('Se creará un mesociclo nuevo. El historial de entrenamientos se conserva. ¿Continuar?')) {
              regeneratePlan(profile, plan.weeks)
            }
          }}
        >
          Regenerar ahora
        </button>
        <button className="btn small" onClick={() => db.plans.update(plan.id, { profileSnapshot: planSnapshot(profile) })}>
          Mantener hasta terminar el mesociclo
        </button>
      </div>
    </div>
  )
}
