export default function PieChart({ data = [] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let start = 0;

  const gradientSegments = data.map((item) => {
    const end = start + (item.value / Math.max(total, 1)) * 100;
    const segment = `${item.color} ${start}% ${end}%`;
    start = end;
    return segment;
  });

  // Cari team dengan instalasi terbanyak (+) dan tersedikit (-) untuk ditandai
  // di legend. Kalau semua nilainya sama (atau data kosong), tidak ada yang
  // ditandai supaya tidak menyesatkan.
  const values = data.map((item) => item.value);
  const maxValue = values.length ? Math.max(...values) : null;
  const minValue = values.length ? Math.min(...values) : null;
  const hasVariation = data.length > 1 && maxValue !== minValue;

  // Kalau ada beberapa team yang sama-sama mencapai jumlah site terbanyak,
  // icon "+" diberikan ke team yang PERTAMA mencapai jumlah itu berdasarkan
  // tanggal/hari instalasinya (reachedMaxOnDay), bukan sekadar urutan di data.
  let maxIndex = -1;
  if (hasVariation) {
    let earliestDay = Infinity;

    data.forEach((item, index) => {
      if (item.value !== maxValue) {
        return;
      }

      const reachedOnDay = item.reachedMaxOnDay ?? index;

      if (reachedOnDay < earliestDay) {
        earliestDay = reachedOnDay;
        maxIndex = index;
      }
    });
  }

  const minIndex = hasVariation ? values.lastIndexOf(minValue) : -1;

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
        {data.map((item, index) => {
          const isMax = index === maxIndex;
          const isMin = index === minIndex;

          return (
            <li key={item.label}>
              <span
                className={`legend-rank${isMax ? ' legend-rank--max' : ''}${isMin ? ' legend-rank--min' : ''}`}
                title={isMax ? 'Instalasi terbanyak' : isMin ? 'Instalasi tersedikit' : ''}
              >
                {isMax ? '+' : isMin ? '-' : ''}
              </span>
              <span className="legend-dot" style={{ background: item.color }} />
              <span>{item.label}</span>
              <strong>{item.value} site</strong>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
