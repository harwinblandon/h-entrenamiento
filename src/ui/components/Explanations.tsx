import { Link } from 'react-router-dom'
import { getSource } from '../../domain/evidence'
import type { Confidence, Explanation } from '../../domain/types'

const CONFIDENCE_CLASS: Record<Confidence, string> = { alta: 'accent', moderada: '', baja: 'warn' }

export function ConfidenceBadge({ level }: { level: Confidence }) {
  return <span className={`badge ${CONFIDENCE_CLASS[level]}`}>Confianza {level}</span>
}

export function Explanations({ items }: { items: Explanation[] }) {
  return (
    <div className="stack">
      {items.map((e) => (
        <div className="explain" key={e.title}>
          <div className="row" style={{ marginBottom: '0.2rem' }}>
            <h3 style={{ margin: 0 }}>{e.title}</h3>
            <ConfidenceBadge level={e.confidence} />
          </div>
          <p>{e.text}</p>
          {e.sourceIds.length > 0 && (
            <div className="sources">
              Fuente:{' '}
              {e.sourceIds.map((id, i) => (
                <span key={id}>
                  {i > 0 && '; '}
                  <Link to={`/evidencia#${id}`}>{getSource(id)?.citation.split('.')[0] ?? id}</Link>
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
