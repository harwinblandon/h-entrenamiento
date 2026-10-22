import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { EVIDENCE, EVIDENCE_REVIEWED } from '../../domain/evidence'
import { ConfidenceBadge } from '../components/Explanations'

export function EvidencePage() {
  const { hash } = useLocation()

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  return (
    <div className="stack">
      <div>
        <h1>Biblioteca de evidencia</h1>
        <p className="muted">
          Fuentes en las que se basan las reglas de la app. Última revisión: {new Date(EVIDENCE_REVIEWED).toLocaleDateString('es')}. Las
          fórmulas y rangos son puntos de partida; las decisiones posteriores se basan en tu respuesta individual.
        </p>
      </div>
      {EVIDENCE.map((s) => (
        <article
          className="card stack-sm"
          id={s.id}
          key={s.id}
          style={hash === `#${s.id}` ? { borderColor: 'var(--accent)' } : undefined}
        >
          <div className="row">
            <h2 style={{ margin: 0 }}>{s.topic}</h2>
            <span className="badge">{s.type}</span>
            <ConfidenceBadge level={s.confidence} />
          </div>
          <p>{s.finding}</p>
          <p style={{ fontSize: '0.9rem' }}>
            <strong>En la app:</strong> {s.appliesTo}
          </p>
          <p style={{ fontSize: '0.9rem' }}>
            <strong>Limitaciones:</strong> {s.limitations}
          </p>
          <p className="sources">{s.citation}</p>
        </article>
      ))}
      <article className="card stack-sm" id="creditos">
        <h2 style={{ margin: 0 }}>Créditos de las ilustraciones</h2>
        <p style={{ fontSize: '0.9rem', margin: 0 }}>
          Las ilustraciones de los ejercicios provienen de{' '}
          <a href="https://github.com/everkinetic/data" target="_blank" rel="noreferrer">
            Everkinetic
          </a>{' '}
          (proyecto basado en everkinetic.com, creado por Greg Priday) y se usan bajo la licencia{' '}
          <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.es" target="_blank" rel="noreferrer">
            CC BY-SA 4.0
          </a>
          . Se adaptaron al tema oscuro (trazo claro sobre fondo transparente); las adaptaciones se comparten bajo la misma
          licencia. Cuando una ilustración muestra un ejercicio de patrón parecido y no exactamente el mismo, se indica como
          «patrón similar».
        </p>
      </article>
    </div>
  )
}
