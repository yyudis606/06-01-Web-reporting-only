'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doesSessionExist, signOut } from 'supertokens-auth-react/recipe/session';
import Card from './charts/Card';
import LineChart from './charts/LineChart';
import BarChart from './charts/BarChart';
import PieChart from './charts/PieChart';
import packageInfo from '../../../package.json';
import {
  dashboardText,
  divisionChartData,
  divisionResults,
  progressTrend,
  siteStatuses,
  summaryCards,
  updateSchedules,
  weeklyResults,
} from '../../../data/dashboardData';

const fallbackDashboardData = {
  dashboardText,
  divisionChartData,
  divisionResults,
  progressTrend,
  siteStatuses,
  summaryCards,
  updateSchedules,
  weeklyResults,
};

export default function DashboardContent({ initialData = null }) {
  const router = useRouter();
  const [exportError, setExportError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminLinkLabel, setAdminLinkLabel] = useState('Admin');
  const [dashboardData, setDashboardData] = useState(initialData);

  useEffect(() => {
    let isMounted = true;

    async function loadSessionInfo() {
      try {
        const sessionExists = await doesSessionExist();

        if (!isMounted) {
          return;
        }

        setIsLoggedIn(sessionExists);

        if (!sessionExists) {
          setAdminLinkLabel('Admin');
          return;
        }

        const response = await fetch('/api/admin/me', { cache: 'no-store' });

        if (!isMounted) {
          return;
        }

        if (response.ok) {
          const data = await response.json();
          setAdminLinkLabel(data.isAdministrator ? 'Administrator' : 'Admin');
          return;
        }

        if (response.status === 401 || response.status === 440) {
          // Sesi di browser sudah tidak valid lagi (misalnya akun sudah dihapus).
          // Bersihkan sesi supaya tidak terus dikirim ulang ke server.
          try {
            await signOut();
          } catch {
            // Abaikan; sesi mungkin sudah terhapus di sisi server.
          }
          setIsLoggedIn(false);
          setAdminLinkLabel('Admin');
          return;
        }

        console.error('Failed to load admin role:', response.status);
      } catch (error) {
        console.error('Failed to load admin session info:', error);
      }
    }

    loadSessionInfo();

    if (initialData) {
      return () => {
        isMounted = false;
      };
    }

    fetch('/api/content')
      .then((response) => response.json())
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setDashboardData({
          dashboardText: data.dashboardText,
          divisionChartData: data.divisionChartData,
          divisionResults: data.divisionResults,
          progressTrend: data.progressTrend,
          siteStatuses: Array.isArray(data.siteStatuses) ? data.siteStatuses : siteStatuses,
          summaryCards: data.summaryCards,
          updateSchedules: data.updateSchedules,
          weeklyResults: data.weeklyResults,
        });
      })
      .catch((error) => {
        console.error('Failed to load editable dashboard content:', error);
        if (isMounted) {
          setDashboardData(fallbackDashboardData);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [initialData]);

  const handleLogout = async () => {
    await signOut();
    setIsLoggedIn(false);
    setAdminLinkLabel('Admin');
    router.push('/auth');
  };

  const handleExport = async () => {
    setExportError('');
    setIsExporting(true);

    try {
      const response = await fetch('/api/export');

      if (!response.ok) {
        throw new Error(`Export gagal dengan status ${response.status}`);
      }

      const file = await response.blob();
      const disposition = response.headers.get('Content-Disposition') || '';
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] || 'progress-pekerjaan.xlsx';
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export progress report:', error);
      setExportError('File Excel gagal dibuat. Silakan coba kembali.');
    } finally {
      setIsExporting(false);
    }
  };

  if (!dashboardData) {
    return (
      <main className="dashboard-page dashboard-page--loading">
        <section className="dashboard-loading" role="status" aria-live="polite">
          <p className="eyebrow">Memuat Data</p>
          <h1>Memuat dashboard terbaru...</h1>
          <span>Mohon tunggu sebentar.</span>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">{dashboardData.dashboardText.subtitle}</p>
          <h1>{dashboardData.dashboardText.title}</h1>
        </div>
        <div className="dashboard-header__actions">
          <button
            type="button"
            className="dashboard-header__button"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? 'Membuat Excel...' : dashboardData.dashboardText.exportButton}
          </button>
          {isLoggedIn ? (
            <>
              <Link className="dashboard-header__button dashboard-header__button--ghost" href="/admin">
                {adminLinkLabel}
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
      {exportError ? <p className="dashboard-export-error" role="alert">{exportError}</p> : null}

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

        <article className="panel site-status">
          <div className="site-status__header">
            <div>
              <p className="eyebrow">Detail Site</p>
              <h2>Status Site &amp; Team Lokasi</h2>
            </div>
            <span>{dashboardData.siteStatuses.length} site</span>
          </div>

          <div className="site-status__list">
            {dashboardData.siteStatuses.map((site, index) => (
              <div key={`${site.name}-${index}`} className="site-status__item">
                <span className="site-status__number">{index + 1}</span>
                <div className="site-status__content">
                  <strong>{site.name}</strong>
                  <span>{site.team}</span>
                  {site.note ? <small>Note: {site.note}</small> : null}
                </div>
                <span className={`site-status__badge site-status__badge--${site.status.toLowerCase()}`}>
                  {site.status}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <footer className="dashboard-footer">
        <span className="dashboard-footer__text">
          <span className="dashboard-footer__brand">
            <Image
              src="/images/brand/Logo devanycode (box).svg"
              alt=""
              width={28}
              height={28}
              className="dashboard-footer__logo"
            />
            <span>&copy; 2026 Created by devANYcode</span>
          </span>
          <span className="dashboard-footer__version">v{packageInfo.version}</span>
        </span>
      </footer>
    </main>
  );
}
