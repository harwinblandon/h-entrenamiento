import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

export interface ChartSeries {
  id: string
  label: string
  kind: 'line' | 'dots'
  /** Rol de color: la serie principal en marfil, la secundaria en gris. */
  tone: 'primary' | 'secondary'
  points: { t: number; y: number }[]
}

interface Props {
  series: ChartSeries[]
  formatY: (y: number) => string
  ariaLabel: string
  height?: number
}

const M = { top: 14, right: 56, bottom: 28, left: 44 }
const TONE = { primary: 'var(--chart-primary)', secondary: 'var(--chart-secondary)' }

/** Marcas "limpias" para el eje Y (1, 2, 2.5, 5 × 10ⁿ). */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    min -= 1
    max += 1
  }
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
  const ticks: number[] = []
  for (let v = Math.floor(min / step) * step; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 1000) / 1000)
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step)
  return ticks
}

const fmtDate = (t: number, long = false) =>
  new Date(t).toLocaleDateString('es', long ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' })

export function TimeChart({ series, formatY, ariaLabel, height = 220 }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const times = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.t)))].sort((a, b) => a - b), [series])
  const ys = series.flatMap((s) => s.points.map((p) => p.y))
  if (times.length === 0) return null

  const pad = Math.max((Math.max(...ys) - Math.min(...ys)) * 0.1, 0.5)
  const yTicks = niceTicks(Math.min(...ys) - pad, Math.max(...ys) + pad)
  const [y0, y1] = [yTicks[0], yTicks[yTicks.length - 1]]
  const [t0, t1] = times.length > 1 ? [times[0], times[times.length - 1]] : [times[0] - 86_400_000, times[0] + 86_400_000]
  const w = width - M.left - M.right
  const h = height - M.top - M.bottom
  const x = (t: number) => M.left + ((t - t0) / (t1 - t0)) * w
  const y = (v: number) => M.top + (1 - (v - y0) / (y1 - y0)) * h

  const xTickCount = Math.min(times.length, width < 420 ? 3 : 5)
  const xTicks =
    xTickCount <= 1 ? times : Array.from({ length: xTickCount }, (_, i) => times[Math.round((i * (times.length - 1)) / (xTickCount - 1))])

  const nearest = (px: number) => {
    let best = 0
    times.forEach((t, i) => {
      if (Math.abs(x(t) - px) < Math.abs(x(times[best]) - px)) best = i
    })
    return best
  }
  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setHover(nearest(e.clientX - r.left + M.left))
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') setHover((i) => Math.min(times.length - 1, (i ?? -1) + 1))
    else if (e.key === 'ArrowLeft') setHover((i) => Math.max(0, (i ?? times.length) - 1))
    else if (e.key === 'Escape') setHover(null)
    else return
    e.preventDefault()
  }

  const hoverT = hover !== null ? times[hover] : null
  const main = series[0]
  const last = main.points[main.points.length - 1]

  return (
    <div className="chart" ref={wrap}>
      {series.length > 1 && (
        <div className="chart-legend">
          {series.map((s) => (
            <span key={s.id}>
              {s.kind === 'line' ? (
                <svg width="16" height="8" aria-hidden="true"><line x1="0" y1="4" x2="16" y2="4" stroke={TONE[s.tone]} strokeWidth="2" strokeLinecap="round" /></svg>
              ) : (
                <svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill={TONE[s.tone]} /></svg>
              )}
              {s.label}
            </span>
          ))}
        </div>
      )}
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
        style={{ display: 'block', outline: 'none' }}
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={width - M.right} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth="1" />
            <text x={M.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="chart-axis">
              {formatY(v)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={x(t)} y={height - 8} textAnchor="middle" className="chart-axis">
            {fmtDate(t)}
          </text>
        ))}

        {hoverT !== null && <line x1={x(hoverT)} x2={x(hoverT)} y1={M.top} y2={M.top + h} stroke="var(--muted)" strokeWidth="1" />}

        {[...series].reverse().map((s) =>
          s.kind === 'line' ? (
            <path
              key={s.id}
              d={s.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t)},${y(p.y)}`).join('')}
              fill="none"
              stroke={TONE[s.tone]}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ) : (
            <g key={s.id}>
              {s.points.map((p) => (
                <circle key={p.t} cx={x(p.t)} cy={y(p.y)} r="4" fill={TONE[s.tone]} stroke="var(--surface-solid)" strokeWidth="2" />
              ))}
            </g>
          ),
        )}

        {main.kind === 'line' && <circle cx={x(last.t)} cy={y(last.y)} r="4" fill={TONE[main.tone]} stroke="var(--surface-solid)" strokeWidth="2" />}
        <text x={x(last.t) + 8} y={y(last.y)} dy="0.32em" className="chart-end-label">
          {formatY(last.y)}
        </text>

        {hoverT !== null &&
          series.map((s) => {
            const p = s.points.find((q) => q.t === hoverT)
            return p ? <circle key={s.id} cx={x(p.t)} cy={y(p.y)} r="5" fill={TONE[s.tone]} stroke="var(--surface-solid)" strokeWidth="2" /> : null
          })}

        <rect
          x={M.left}
          y={M.top}
          width={w}
          height={h}
          fill="transparent"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>

      {hoverT !== null && (
        <div
          className="chart-tooltip"
          style={{ left: Math.min(Math.max(x(hoverT), 70), width - 70), top: 0 }}
          role="status"
        >
          <div className="chart-tooltip-date">{fmtDate(hoverT, true)}</div>
          {series.map((s) => {
            const p = s.points.find((q) => q.t === hoverT)
            if (!p) return null
            return (
              <div key={s.id} className="chart-tooltip-row">
                <svg width="12" height="8" aria-hidden="true"><line x1="0" y1="4" x2="12" y2="4" stroke={TONE[s.tone]} strokeWidth="2" strokeLinecap="round" /></svg>
                <strong>{formatY(p.y)}</strong>
                <span>{s.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
