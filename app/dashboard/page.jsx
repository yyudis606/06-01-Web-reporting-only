import Card from '../../components/Card';
import LineChart from '../../components/LineChart';
import BarChart from '../../components/BarChart';
import PieChart from '../../components/PieChart';
import {
  dashboardText,
  divisionChartData,
  divisionResults,
  progressTrend,
  summaryCards,
  updateSchedules,
  weeklyResults,
} from '../../data/dashboardData';
import './style.scss';

export default function DashboardPage() {
  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">{dashboardText.subtitle}</p>
          <h1>{dashboardText.title}</h1>
        </div>
        <button type="button" className="dashboard-header__button">
          {dashboardText.exportButton}
        </button>
      </header>

      <section className="summary-grid">
        {summaryCards.map((card) => (
          <Card
            key={card.title}
            title={card.title}
            value={card.value}
            detail={card.detail}
            tone={card.tone}
          />
        ))}
      </section>

      <section className="update-notice">
        <div>
          <p className="eyebrow">{dashboardText.updatePanel.subtitle}</p>
          <h2>{dashboardText.updatePanel.title}</h2>
          <p>{dashboardText.updatePanel.description}</p>
        </div>

        <div className="update-notice__times">
          {updateSchedules.map((schedule) => (
            <div key={schedule.time} className="update-time">
              <strong>{schedule.time}</strong>
              <span>{schedule.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="charts-grid">
        <article className="panel panel--wide">
          <div className="panel__header">
            <div>
              <p className="eyebrow">{dashboardText.trendPanel.subtitle}</p>
              <h2>{dashboardText.trendPanel.title}</h2>
            </div>
            <span className="tag tag--success">{dashboardText.trendPanel.badge}</span>
          </div>
          <LineChart data={progressTrend} />
        </article>

        <article className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">{dashboardText.weeklyPanel.subtitle}</p>
              <h2>{dashboardText.weeklyPanel.title}</h2>
            </div>
          </div>
          <BarChart data={weeklyResults} />
        </article>

        <article className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">{dashboardText.divisionPanel.subtitle}</p>
              <h2>{dashboardText.divisionPanel.title}</h2>
            </div>
          </div>
          <PieChart data={divisionChartData} />
        </article>

        <article className="panel panel--wide">
          <div className="panel__header">
            <div>
              <p className="eyebrow">{dashboardText.workPanel.subtitle}</p>
              <h2>{dashboardText.workPanel.title}</h2>
            </div>
          </div>

          <div className="work-results">
            {divisionResults.map((item) => (
              <div key={item.division} className="work-result">
                <span className="legend-dot" style={{ background: item.color }} />
                <div>
                  <strong>{item.division}</strong>
                  <p>{item.result}</p>
                  <small>
                    Done: {item.progress} site | Hold: {item.hold} site | Cancel: {item.cancel} site
                  </small>
                </div>
                <span className="work-result__status">{item.status}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <footer className="dashboard-footer">
        Created by devANYcode
      </footer>
    </main>
  );
}
