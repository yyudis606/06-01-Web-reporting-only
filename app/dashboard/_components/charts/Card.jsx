export default function Card({ title, value, detail, tone = 'primary' }) {
  return (
    <article className={`summary-card summary-card--${tone}`}>
      <span className="summary-card__title">{title}</span>
      <strong className="summary-card__value">{value}</strong>
      <small className="summary-card__detail">{detail}</small>
    </article>
  );
}
