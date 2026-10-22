import { useState } from 'react'
import { EXERCISE_IMAGES } from '../../domain/exerciseImages'

const src = (name: string, frame: 1 | 2) => `${import.meta.env.BASE_URL}exercises/${name}-${frame}.webp`

/**
 * Patrón de movimiento del ejercicio (posición estirada y contraída). Oculto hasta que se pide,
 * para no ocupar espacio ni descargar imágenes que no se van a ver.
 */
export function ExerciseIllustration({
  exerciseId,
  exerciseName,
  compact = false,
}: {
  exerciseId: string
  exerciseName: string
  /** Enlace discreto en lugar de botón (p. ej. en las tablas del plan). */
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const image = EXERCISE_IMAGES[exerciseId]
  if (!image) return null

  return (
    <div className="illustration">
      <button type="button" className={compact ? 'link-btn' : 'btn small'} aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Ocultar ilustración' : 'Ver cómo se hace'}
      </button>
      {open && (
        <figure className="illustration-figure">
          <div className="illustration-frames">
            <div>
              <img src={src(image.name, 1)} alt={`${exerciseName}: posición estirada`} loading="lazy" />
              <span>Estirado</span>
            </div>
            <span className="illustration-arrow" aria-hidden="true">
              ⇄
            </span>
            <div>
              <img src={src(image.name, 2)} alt={`${exerciseName}: posición contraída`} loading="lazy" />
              <span>Contraído</span>
            </div>
          </div>
          <figcaption>
            {image.approx && <strong>Patrón similar: </strong>}
            Ilustración: Everkinetic, CC BY-SA 4.0 (adaptada al tema oscuro).
          </figcaption>
        </figure>
      )}
    </div>
  )
}
