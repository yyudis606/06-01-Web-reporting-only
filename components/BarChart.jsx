export default function BarChart({ data = [] }) {
  const max = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="bar-chart" aria-label="Bar chart">
      {data.map((item) => (
        <div key={item.label} className="bar-chart__column">
          <span className="bar-chart__value">{item.value}</span>
          <div className="bar-chart__track">
            <div
              className="bar-chart__bar"
              style={{ height: `${(item.value / max) * 100}%` }}
            />
          </div>
          <span className="bar-chart__label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
