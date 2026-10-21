import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { deleteProfile, exportData, importData } from '../../db/db'
import { EXPERIENCE_LABELS, GOAL_LABELS } from '../../domain/labels'
import { evaluateSafety } from '../../domain/safety'
import { todayISO } from '../../domain/schedule'
import { useActiveProfile } from '../activeProfile'
import { applyFont, FONT_OPTIONS, storedFont } from '../appearance'

export function People() {
  const { profiles, active, setActiveId, isLocked } = useActiveProfile()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string>()
  const [font, setFont] = useState(storedFont)

  async function onExport() {
    const data = await exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `respaldo-entrenamiento-${todayISO()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function onImport(file: File) {
    try {
      const n = await importData(JSON.parse(await file.text()))
      setMessage(`Respaldo importado: ${n} persona(s).`)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No se pudo importar el archivo.')
    }
  }

  async function onDelete(id: string, name: string) {
    if (!confirm(`¿Eliminar a ${name} y todo su historial? Esta acción no se puede deshacer.`)) return
    await deleteProfile(id)
    if (active?.id === id) setActiveId(undefined)
  }

  return (
    <div className="stack">
      <div className="spread">
        <h1>Personas</h1>
        <Link to="/personas/nueva" className="btn primary">
          + Nueva persona
        </Link>
      </div>

      {profiles?.length === 0 && <div className="card empty">Aún no hay personas. Crea la primera para generar su plan.</div>}

      <div className="grid">
        {profiles?.map((p) => {
          const safety = evaluateSafety(p.safety)
          const isActive = active?.id === p.id
          if (isLocked(p)) {
            return (
              <div className="card stack-sm" key={p.id} style={isActive ? { borderColor: 'var(--accent)' } : undefined}>
                <div className="spread">
                  <h2 style={{ margin: 0 }}>{p.name}</h2>
                  <span className="badge">Con clave</span>
                </div>
                <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
                  Datos protegidos. Desbloquea para verlos o editarlos.
                </p>
                <div className="row" style={{ marginTop: '0.3rem' }}>
                  <button
                    className="btn small"
                    onClick={() => {
                      setActiveId(p.id)
                      navigate('/')
                    }}
                  >
                    Desbloquear
                  </button>
                </div>
              </div>
            )
          }
          return (
            <div className="card stack-sm" key={p.id} style={isActive ? { borderColor: 'var(--accent)' } : undefined}>
              <div className="spread">
                <h2 style={{ margin: 0 }}>{p.name}</h2>
                {isActive && <span className="badge accent">Activa</span>}
              </div>
              <div className="muted" style={{ fontSize: '0.88rem' }}>
                {p.age} años · {EXPERIENCE_LABELS[p.experience]} · {p.daysPerWeek} días/sem
                <br />
                {GOAL_LABELS[p.goal]}
              </div>
              <div className="row">
                {p.status === 'calibration' && <span className="badge">Calibración</span>}
                {p.pin && <span className="badge">Con clave</span>}
                {safety.level === 'clearance_required' && <span className="badge danger">Requiere autorización</span>}
                {safety.level === 'caution' && <span className="badge warn">Precauciones</span>}
              </div>
              <div className="row" style={{ marginTop: '0.3rem' }}>
                {!isActive && (
                  <button className="btn small" onClick={() => setActiveId(p.id)}>
                    Seleccionar
                  </button>
                )}
                <Link className="btn small" to={`/personas/${p.id}`}>
                  Editar ficha
                </Link>
                <button className="btn small danger" onClick={() => onDelete(p.id, p.name)}>
                  Eliminar
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="card stack-sm">
        <h2>Apariencia</h2>
        <p className="muted">Tipografía de la app. El cambio se aplica al instante y se recuerda en este dispositivo.</p>
        <div className="font-options">
          {FONT_OPTIONS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`font-option ${font === f.id ? 'on' : ''}`}
              aria-pressed={font === f.id}
              style={{ fontFamily: f.family }}
              onClick={() => {
                applyFont(f.id)
                setFont(f.id)
              }}
            >
              <span className="font-sample">Press de banca 4 × 8</span>
              <span className="font-name">
                {f.label} · {f.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="card stack-sm">
        <h2>Respaldo de datos</h2>
        <p className="muted">
          Los datos se guardan solo en este dispositivo y navegador. Exporta un respaldo con regularidad y úsalo para pasar
          los datos a otro dispositivo.
        </p>
        <div className="row">
          <button className="btn" onClick={onExport}>
            Exportar respaldo (JSON)
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Importar respaldo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onImport(f)
              e.target.value = ''
            }}
          />
        </div>
        {message && <div className="alert info">{message}</div>}
      </div>
    </div>
  )
}
