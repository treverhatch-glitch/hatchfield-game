/** Small SVG line chart — no chart library. Multiple series share one scale. */
export function LineChart({
  title,
  series,
  empty,
}: {
  title: string
  series: { name: string; color: string; values: number[] }[]
  empty?: string
}) {
  const width = 280
  const height = 96
  const pad = 8
  const longest = Math.max(1, ...series.map((s) => s.values.length))
  const flat = series.flatMap((s) => s.values)
  const has = flat.length > 0
  const min = has ? Math.min(...flat) : 0
  const max = has ? Math.max(...flat) : 1
  const span = max - min || 1
  const xAt = (i: number) => pad + (i / Math.max(1, longest - 1)) * (width - pad * 2)
  const yAt = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2)

  return (
    <figure className="line-chart">
      <figcaption>
        {title}
        {has ? (
          <span className="muted">
            {' '}
            {Math.round(min).toLocaleString('en-US')}–{Math.round(max).toLocaleString('en-US')}
          </span>
        ) : null}
      </figcaption>
      {has ? (
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
          {series.map((s) =>
            s.values.length ? (
              <polyline
                key={s.name}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                points={s.values.map((v, i) => `${xAt(i)},${yAt(v)}`).join(' ')}
              />
            ) : null,
          )}
        </svg>
      ) : (
        <p className="muted">{empty ?? 'No points yet.'}</p>
      )}
      <ul className="chart-legend">
        {series.map((s) => (
          <li key={s.name}>
            <i style={{ background: s.color }} />
            {s.name}
          </li>
        ))}
      </ul>
    </figure>
  )
}
