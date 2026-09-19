export default function PieChart({ data = [] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let start = 0;

  const gradientSegments = data.map((item) => {
    const end = start + (item.value / Math.max(total, 1)) * 100;
    const segment = `${item.color} ${start}% ${end}%`;
    start = end;
    return segment;
  });

  return (
    <div className="pie-chart">
      <div
        className="pie-chart__ring"
        style={{
          background: `conic-gradient(${gradientSegments.join(', ')})`,
        }}
      >
        <div className="pie-chart__center">
          <strong>{total} site</strong>
        </div>
      </div>

      <ul className="pie-chart__legend">
        {data.map((item) => (
          <li key={item.label}>
            <span className="legend-dot" style={{ background: item.color }} />
            <span>{item.label}</span>
            <strong>{item.value} site</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
