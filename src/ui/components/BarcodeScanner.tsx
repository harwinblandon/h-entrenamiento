import { useEffect, useRef, useState } from 'react'

interface NativeDetector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>
}
interface NativeDetectorCtor {
  new (opts: { formats: string[] }): NativeDetector
  getSupportedFormats(): Promise<string[]>
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e']
const VIDEO: MediaStreamConstraints = { video: { facingMode: 'environment' }, audio: false }

export const isBarcode = (s: string) => /^\d{8,14}$/.test(s)

function cameraError(e: unknown): string {
  const name = (e as { name?: string })?.name
  if (name === 'NotAllowedError') return 'Sin permiso para usar la cámara. Actívalo en los ajustes del navegador o escribe el código.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No se encontró una cámara. Escribe el código de barras.'
  return 'No se pudo abrir la cámara. Escribe el código de barras.'
}

/**
 * Lee códigos de barras de productos (EAN/UPC) con la cámara trasera. Usa el lector nativo del
 * navegador cuando existe (Android) y, si no, una librería que se descarga solo al abrirlo (iPhone).
 */
export function BarcodeScanner({ onCode, onCancel }: { onCode: (code: string) => void; onCancel: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const onCodeRef = useRef(onCode)
  onCodeRef.current = onCode
  const [error, setError] = useState<string>()
  const [ready, setReady] = useState(false)
  const [manual, setManual] = useState('')

  useEffect(() => {
    let stop = () => {}
    let cancelled = false
    let done = false
    const found = (code: string) => {
      if (done || !isBarcode(code)) return
      done = true
      stop()
      onCodeRef.current(code)
    }

    void (async () => {
      try {
        const Native = (window as unknown as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector
        const nativeOk = Native ? (await Native.getSupportedFormats()).includes('ean_13') : false
        if (Native && nativeOk) {
          const stream = await navigator.mediaDevices.getUserMedia(VIDEO)
          if (cancelled) return stream.getTracks().forEach((t) => t.stop())
          const video = videoRef.current!
          video.srcObject = stream
          await video.play()
          setReady(true)
          const detector = new Native({ formats: FORMATS })
          let timer: ReturnType<typeof setTimeout>
          const tick = async () => {
            if (done || cancelled) return
            try {
              const codes = await detector.detect(video)
              if (codes[0]) return found(codes[0].rawValue)
            } catch {
              // Cuadro sin imagen todavía: se reintenta.
            }
            timer = setTimeout(tick, 150)
          }
          void tick()
          stop = () => {
            clearTimeout(timer)
            stream.getTracks().forEach((t) => t.stop())
          }
        } else {
          const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
            import('@zxing/browser'),
            import('@zxing/library'),
          ])
          if (cancelled) return
          const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]]])
          const reader = new BrowserMultiFormatReader(hints)
          const controls = await reader.decodeFromConstraints(VIDEO, videoRef.current!, (result) => {
            if (result) found(result.getText())
          })
          stop = () => controls.stop()
          if (cancelled || done) stop()
          else setReady(true)
        }
      } catch (e) {
        if (!cancelled) setError(cameraError(e))
      }
    })()

    return () => {
      cancelled = true
      stop()
    }
  }, [])

  return (
    <div className="stack-sm">
      {!error && (
        <div className="scanner">
          <video ref={videoRef} playsInline muted autoPlay />
          <span className="scanner-guide" />
          {!ready && <span className="scanner-msg">Abriendo la cámara…</span>}
        </div>
      )}
      {error ? (
        <div className="alert warn">{error}</div>
      ) : (
        <span className="muted" style={{ fontSize: '0.8rem' }}>
          Apunta al código de barras del empaque, con buena luz y a unos 15 cm.
        </span>
      )}
      <form
        className="row"
        style={{ flexWrap: 'nowrap' }}
        onSubmit={(e) => {
          e.preventDefault()
          if (isBarcode(manual.trim())) onCodeRef.current(manual.trim())
        }}
      >
        <input
          inputMode="numeric"
          aria-label="Código de barras"
          placeholder="O escribe el código (8 a 14 números)"
          value={manual}
          onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))}
        />
        <button type="submit" className="btn small" disabled={!isBarcode(manual)}>
          Buscar
        </button>
        <button type="button" className="btn small" onClick={onCancel}>
          Cerrar
        </button>
      </form>
    </div>
  )
}
