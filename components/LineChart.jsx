export default function LineChart({ data = [] }) {
  const width = 500;
  const height = 220;
  const padding = 26;
  const values = data.map((item) => item.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);

  const points = values
    .map((value, index) => {
      const x = padding + (index * (width - padding * 2)) / Math.max(values.length - 1, 1);
      const y = height - padding - ((value - min) / (Math.max(max - min, 1) || 1)) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  const areaPoints = `${points} ${width - padding},${height - padding} ${padding},${height - padding}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="line-chart" aria-label="Line chart">
      <defs>
        <linearGradient id="lineGradient" x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>

      {[0, 1, 2, 3].map((step) => (
        <line
          key={step}
          x1={padding}
          x2={width - padding}
          y1={padding + step * 45}
          y2={padding + step * 45}
          stroke="rgba(148, 163, 184, 0.2)"
          strokeDasharray="4 6"
        />
      ))}

      <polygon points={areaPoints} fill="url(#lineGradient)" opacity="0.15" />
      <polyline
        fill="none"
        stroke="url(#lineGradient)"
        strokeWidth="4"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />

      {data.map((item, index) => {
        const x = padding + (index * (width - padding * 2)) / Math.max(values.length - 1, 1);
        const value = item.value;
        const y = height - padding - ((value - min) / (Math.max(max - min, 1) || 1)) * (height - padding * 2);

        return (
          <g key={`${item.label}-${index}`}>
            <circle cx={x} cy={y} r="5" fill="#e2e8f0" />
            <circle cx={x} cy={y} r="10" fill="rgba(99, 102, 241, 0.15)" />
            <text x={x} y={height - 4} textAnchor="middle" className="line-chart__label">
              {item.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
