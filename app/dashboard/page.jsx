'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doesSessionExist, signOut } from 'supertokens-auth-react/recipe/session';
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
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    dashboardText,
    divisionChartData,
    divisionResults,
    progressTrend,
    summaryCards,
    updateSchedules,
    weeklyResults,
  });

  useEffect(() => {
    doesSessionExist().then(setIsLoggedIn);

    fetch('/api/content')
      .then((response) => response.json())
      .then((data) => {
        setDashboardData({
          dashboardText: data.dashboardText,
          divisionChartData: data.divisionChartData,
          divisionResults: data.divisionResults,
          progressTrend: data.progressTrend,
          summaryCards: data.summaryCards,
          updateSchedules: data.updateSchedules,
          weeklyResults: data.weeklyResults,
        });
      })
      .catch((error) => {
        console.error('Failed to load editable dashboard content:', error);
      });
  }, []);

  const handleLogout = async () => {
    await signOut();
    setIsLoggedIn(false);
    router.push('/auth');
  };

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">{dashboardData.dashboardText.subtitle}</p>
          <h1>{dashboardData.dashboardText.title}</h1>
        </div>
        <div className="dashboard-header__actions">
          <button type="button" className="dashboard-header__button">
            {dashboardData.dashboardText.exportButton}
          </button>
          {isLoggedIn ? (
            <>
              <Link className="dashboard-header__button dashboard-header__button--ghost" href="/admin">
                Admin
              </Link>
              <button
                type="button"
                className="dashboard-header__button dashboard-header__button--ghost"
                onClick={handleLogout}
              >
                Logout
              </button>
            </>
          ) : (
            <Link className="dashboard-header__button dashboard-header__button--ghost" href="/auth">
              Login Admin
            </Link>
          )}
        </div>
      </header>

      <section className="summary-grid">
        {dashboardData.summaryCards.map((card) => (
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
          <p className="eyebrow">{dashboardData.dashboardText.updatePanel.subtitle}</p>
          <h2>{dashboardData.dashboardText.updatePanel.title}</h2>
          <p>{dashboardData.dashboardText.updatePanel.description}</p>
        </div>

        <div className="update-notice__times">
          {dashboardData.updateSchedules.map((schedule) => (
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
              <p className="eyebrow">{dashboardData.dashboardText.trendPanel.subtitle}</p>
              <h2>{dashboardData.dashboardText.trendPanel.title}</h2>
            </div>
            <span className="tag tag--success">{dashboardData.dashboardText.trendPanel.badge}</span>
          </div>
          <LineChart data={dashboardData.progressTrend} />
        </article>

        <article className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">{dashboardData.dashboardText.weeklyPanel.subtitle}</p>
              <h2>{dashboardData.dashboardText.weeklyPanel.title}</h2>
            </div>
          </div>
          <BarChart data={dashboardData.weeklyResults} />
        </article>

        <article className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">{dashboardData.dashboardText.divisionPanel.subtitle}</p>
              <h2>{dashboardData.dashboardText.divisionPanel.title}</h2>
            </div>
          </div>
          <PieChart data={dashboardData.divisionChartData} />
        </article>

        <article className="panel panel--wide">
          <div className="panel__header">
            <div>
              <p className="eyebrow">{dashboardData.dashboardText.workPanel.subtitle}</p>
              <h2>{dashboardData.dashboardText.workPanel.title}</h2>
            </div>
          </div>

          <div className="work-results">
            {dashboardData.divisionResults.map((item) => (
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
        <Image
          src="/images/brand/Logo devanycode (box).svg"
          alt=""
          width={28}
          height={28}
          className="dashboard-footer__logo"
        />
        <span>Created by devANYcode</span>
      </footer>
    </main>
  );
}
