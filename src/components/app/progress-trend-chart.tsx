type TrendPoint = {
  dateKey: string;
  label: string;
  totalQp: number;
  expGained: number;
};

function formatQpValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function ProgressTrendChart({
  title,
  subtitle,
  points,
}: {
  title: string;
  subtitle?: string;
  points?: TrendPoint[];
}) {
  const safePoints = points ?? [];

  if (!safePoints.length) {
    return (
      <section className="quest-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="page-label">Trend</p>
            <h2 className="mt-2 font-serif text-2xl text-stone-50">{title}</h2>
          </div>
          <span className="status-pill">No data yet</span>
        </div>

        {subtitle ? <p className="page-copy mt-3">{subtitle}</p> : null}

        <div className="mt-4 rounded-[1.1rem] border border-white/6 bg-black/15 px-4 py-10 text-sm text-stone-400">
          Log a few quest days and the chart will start mapping your daily QP here.
        </div>
      </section>
    );
  }

  const maxValue = Math.max(...safePoints.map((point) => point.totalQp), 1);
  const width = 520;
  const height = 220;
  const paddingX = 36;
  const paddingY = 18;
  const footerHeight = 34;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2 - footerHeight;
  const labelStep =
    safePoints.length > 12 ? 3 : safePoints.length > 8 ? 2 : 1;
  const gradientId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-trend-fill`;
  const tickValues = [maxValue, maxValue / 2, 0];

  const coordinates = safePoints.map((point, index) => {
    const x =
      safePoints.length === 1
        ? width / 2
        : paddingX + (chartWidth / (safePoints.length - 1)) * index;
    const y = paddingY + chartHeight - (point.totalQp / maxValue) * chartHeight;

    return { ...point, x, y };
  });

  const linePath = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${coordinates.at(-1)?.x ?? width - paddingX} ${height - paddingY} L ${coordinates[0]?.x ?? paddingX} ${height - paddingY} Z`;

  return (
    <section className="quest-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="page-label">Trend</p>
          <h2 className="mt-2 font-serif text-2xl text-stone-50">{title}</h2>
        </div>
        <span className="status-pill">
          <strong>{formatQpValue(safePoints.at(-1)?.totalQp ?? 0)}</strong> last-day QP
        </span>
      </div>

      {subtitle ? <p className="page-copy mt-3">{subtitle}</p> : null}

      <div className="mt-4 rounded-[1.1rem] border border-white/6 bg-black/15 p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-stone-400">
          <span className="status-pill">
            <span className="status-dot" />
            Daily QP
          </span>
          <span className="status-pill">{safePoints.length} day range</span>
          <span className="status-pill">Hover dots for day details</span>
        </div>

        <svg
          aria-label={title}
          className="h-auto w-full"
          viewBox={`0 0 ${width} ${height}`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(214,183,122,0.35)" />
              <stop offset="100%" stopColor="rgba(214,183,122,0)" />
            </linearGradient>
          </defs>

          {tickValues.map((tickValue) => {
            const y = paddingY + chartHeight - (tickValue / maxValue) * chartHeight;

            return (
              <g key={tickValue}>
                <line
                  stroke="rgba(255,255,255,0.07)"
                  strokeDasharray="4 6"
                  strokeWidth="1"
                  x1={paddingX}
                  x2={width - paddingX}
                  y1={y}
                  y2={y}
                />
                <text
                  fill="rgba(255,255,255,0.38)"
                  fontSize="9"
                  textAnchor="end"
                  x={paddingX - 8}
                  y={y + 3}
                >
                  {formatQpValue(tickValue)}
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill={`url(#${gradientId})`} />
          <path
            d={linePath}
            fill="none"
            stroke="rgba(214,183,122,0.95)"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />

          {coordinates.map((point) => (
            <g key={point.dateKey}>
              <title>
                {`${point.label}: ${formatQpValue(point.totalQp)} QP · +${point.expGained.toLocaleString()} EXP`}
              </title>
              <circle
                cx={point.x}
                cy={point.y}
                fill="#0d1117"
                r="5"
                stroke="rgba(214,183,122,0.95)"
                strokeWidth="2"
              />
              {point === coordinates.at(-1) ||
              point === coordinates[0] ||
              coordinates.indexOf(point) % labelStep === 0 ? (
                <text
                  fill="rgba(255,255,255,0.42)"
                  fontSize="8.5"
                  textAnchor="middle"
                  x={point.x}
                  y={height - 14}
                >
                  <tspan x={point.x} dy="0">
                    {point.label.split(" ")[0]}
                  </tspan>
                  <tspan x={point.x} dy="10">
                    {point.label.split(" ")[1] ?? ""}
                  </tspan>
                </text>
              ) : null}
            </g>
          ))}
        </svg>

        <p className="mt-4 text-sm leading-6 text-stone-400">
          The gold line tracks total QP earned per day. The summary cards below use the same
          date range, so you can quickly compare one strong day against your wider momentum.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <article className="mini-card">
            <p className="mini-card-label">Window</p>
            <p className="mini-card-value">{safePoints.length}d</p>
          </article>
          <article className="mini-card">
            <p className="mini-card-label">Peak QP</p>
            <p className="mini-card-value">{formatQpValue(maxValue)}</p>
          </article>
          <article className="mini-card">
            <p className="mini-card-label">Average QP</p>
            <p className="mini-card-value">
              {safePoints.length
                ? (
                    safePoints.reduce((sum, point) => sum + point.totalQp, 0) /
                    safePoints.length
                  ).toFixed(1)
                : "0.0"}
            </p>
          </article>
          <article className="mini-card">
            <p className="mini-card-label">Range EXP</p>
            <p className="mini-card-value">
              +{safePoints
                .reduce((sum, point) => sum + point.expGained, 0)
                .toLocaleString()}
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
