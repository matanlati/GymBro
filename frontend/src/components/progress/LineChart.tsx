import { useState } from 'react'

export interface LinePoint {
  label: string
  value: number
}

interface LineChartProps {
  data: LinePoint[]
  emptyText?: string
  color?: string
  unit?: string
}

const WIDTH = 560
const HEIGHT = 240
const PAD = { top: 24, right: 20, bottom: 40, left: 44 }
const GRID_LINES = 4

// Keep x-axis labels readable: show at most ~8 ticks.
const labelStride = (count: number) => Math.max(1, Math.ceil(count / 8))

// "Nice" rounded bounds so gridlines land on clean numbers.
function niceBounds(min: number, max: number) {
  if (min === max) {
    // Flat series — pad around the single value.
    const pad = Math.max(1, Math.abs(max) * 0.1)
    return { lo: Math.floor(min - pad), hi: Math.ceil(max + pad) }
  }
  const span = max - min
  const pad = span * 0.15
  return { lo: Math.floor(min - pad), hi: Math.ceil(max + pad) }
}

// SVG line chart for a single exercise time-series (e.g. max weight over time),
// with visible value labels, axis ticks, and an HTML hover tooltip.
export default function LineChart({
  data,
  emptyText = 'No data for this exercise yet.',
  color = '#EF4444',
  unit = 'kg',
}: LineChartProps) {
  const [hover, setHover] = useState<number | null>(null)

  if (data.length === 0) {
    return <p className="progress-empty">{emptyText}</p>
  }

  const plotW = WIDTH - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom

  const rawMin = Math.min(...data.map(d => d.value))
  const rawMax = Math.max(...data.map(d => d.value))
  const { lo, hi } = niceBounds(rawMin, rawMax)
  const range = hi - lo || 1

  const x = (i: number) =>
    PAD.left + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW)
  const y = (v: number) => PAD.top + plotH - ((v - lo) / range) * plotH

  const linePath = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`)
    .join(' ')

  const areaPath =
    `${linePath} L ${x(data.length - 1).toFixed(1)} ${(PAD.top + plotH).toFixed(1)} ` +
    `L ${x(0).toFixed(1)} ${(PAD.top + plotH).toFixed(1)} Z`

  const gridValues = Array.from(
    { length: GRID_LINES + 1 },
    (_, k) => lo + (range * k) / GRID_LINES
  )
  const stride = labelStride(data.length)

  // Tooltip position as % of the SVG box, so it stays aligned at any width.
  const hoverPoint = hover !== null ? data[hover] : null
  const tipLeftPct = hover !== null ? (x(hover) / WIDTH) * 100 : 0
  const tipTopPct = hoverPoint ? (y(hoverPoint.value) / HEIGHT) * 100 : 0
  // Flip the tooltip inward near the edges so it never gets clipped.
  const tipAlign: 'left' | 'center' | 'right' =
    tipLeftPct > 82 ? 'right' : tipLeftPct < 18 ? 'left' : 'center'

  return (
    <div className="line-chart-wrap" onMouseLeave={() => setHover(null)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="line-chart"
        role="img"
        aria-label="Strength progression line chart"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="lc-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* horizontal gridlines + y-axis value ticks */}
        {gridValues.map((v, k) => (
          <g key={k}>
            <line
              x1={PAD.left}
              y1={y(v)}
              x2={WIDTH - PAD.right}
              y2={y(v)}
              stroke="#EEF0F3"
              strokeWidth="1"
            />
            <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" className="line-chart-axis">
              {Math.round(v)}
            </text>
          </g>
        ))}

        {/* area + line */}
        <path d={areaPath} fill="url(#lc-area)" />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* hover guide line */}
        {hover !== null && (
          <line
            x1={x(hover)}
            y1={PAD.top}
            x2={x(hover)}
            y2={PAD.top + plotH}
            stroke={color}
            strokeWidth="1"
            strokeDasharray="4 3"
            opacity="0.5"
          />
        )}

        {/* points, value labels, x-axis labels, hover hit areas */}
        {data.map((d, i) => {
          const isHover = hover === i
          const showLabel = data.length <= 12 || i % stride === 0 || isHover
          return (
            <g key={i}>
              {showLabel && (
                <text
                  x={x(i)}
                  y={y(d.value) - 10}
                  textAnchor="middle"
                  className={isHover ? 'line-chart-value hover' : 'line-chart-value'}
                >
                  {d.value}
                </text>
              )}
              <circle
                cx={x(i)}
                cy={y(d.value)}
                r={isHover ? 5 : 3.5}
                fill={color}
                stroke="#fff"
                strokeWidth={isHover ? 2 : 0}
              />
              {i % stride === 0 && (
                <text
                  x={x(i)}
                  y={HEIGHT - 14}
                  textAnchor="middle"
                  className="line-chart-axis"
                >
                  {d.label}
                </text>
              )}
              {/* invisible wide hit target for easy hovering */}
              <rect
                x={x(i) - plotW / (data.length * 2) - 6}
                y={PAD.top}
                width={plotW / data.length + 12}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            </g>
          )
        })}
      </svg>

      {/* HTML tooltip overlay */}
      {hoverPoint && (
        <div
          className={`line-chart-tooltip align-${tipAlign}`}
          style={{ left: `${tipLeftPct}%`, top: `${tipTopPct}%` }}
        >
          <span className="line-chart-tooltip-value">
            {hoverPoint.value} {unit}
          </span>
          <span className="line-chart-tooltip-label">{hoverPoint.label}</span>
        </div>
      )}
    </div>
  )
}
