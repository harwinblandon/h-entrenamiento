import { Link, useNavigate } from 'react-router-dom'
import { activateQueuedPlan } from '../../db/db'
import type { Plan } from '../../domain/types'

/** Qué hacer al completar todas las sesiones: cerrar el mesociclo o, tras la descarga, empezar el siguiente. */
export function CycleComplete({ plan }: { plan: Plan }) {
  const navigate = useNavigate()

  if (plan.kind === 'deload') {
    return (
      <div className="stack-sm">
        <p style={{ margin: 0 }}>Descarga completada. Llegas recuperado al siguiente mesociclo.</p>
        <button
          className="btn primary"
          onClick={async () => {
            if (!(await activateQueuedPlan(plan.profileId))) navigate('/plan')
          }}
        >
          Empezar el siguiente mesociclo
        </button>
      </div>
    )
  }

  return (
    <div className="stack-sm">
      <p style={{ margin: 0 }}>Completaste el mesociclo de {plan.weeks} semanas.</p>
      <Link className="btn primary" to="/plan/cierre">
        Ver el cierre y preparar el siguiente
      </Link>
    </div>
  )
}
