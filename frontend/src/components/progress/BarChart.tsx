export interface BarDatum {
  label: string
  value: number
}

interface BarChartProps {
  data: BarDatum[]
  /** Text shown when there is nothing to plot. */
  emptyText?: string
  barColor?: string
}

// Lightweight pure-CSS bar chart — no charting dependency (Recharts is not
// installed; the codebase renders its own SVG/CSS visuals).
export default function BarChart({
  data,
  emptyText = 'No data yet.',
  barColor = '#F97316',
}: BarChartProps) {
  if (data.length === 0) {
    return <p className="progress-empty">{emptyText}</p>
  }

  const max = Math.max(...data.map(d => d.value), 1)

  return (
    <div className="bar-chart" role="img" aria-label="Bar chart">
      {data.map((d, i) => {
        const heightPct = Math.round((d.value / max) * 100)
        return (
          <div className="bar-chart-col" key={`${d.label}-${i}`}>
            <div className="bar-chart-track">
              <div
                className="bar-chart-fill"
                style={{ height: `${heightPct}%`, background: barColor }}
                title={`${d.label}: ${d.value}`}
              >
                {d.value > 0 && <span className="bar-chart-value">{d.value}</span>}
              </div>
            </div>
            <span className="bar-chart-label">{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}
