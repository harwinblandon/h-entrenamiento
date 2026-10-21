import { useState } from 'react'
import { downloadBackup, lastBackupDate } from '../../db/storage'

const REMIND_AFTER_DAYS = 7

/** Recuerda exportar un respaldo cuando ya hay registros y pasó una semana desde el último. */
export function BackupReminder({ hasData }: { hasData: boolean }) {
  const [last, setLast] = useState(lastBackupDate)
  if (!hasData) return null
  const days = last ? Math.floor((Date.now() - Date.parse(last)) / 86_400_000) : undefined
  if (days !== undefined && days < REMIND_AFTER_DAYS) return null

  return (
    <div className="alert warn spread">
      <span>
        {days === undefined
          ? 'Aún no has guardado un respaldo de tus datos.'
          : `Tu último respaldo fue hace ${days} días.`}{' '}
        Los datos viven solo en este navegador: guarda una copia en tu nube o correo.
      </span>
      <button
        className="btn small primary"
        onClick={async () => {
          await downloadBackup()
          setLast(lastBackupDate())
        }}
      >
        Descargar respaldo
      </button>
    </div>
  )
}
