import pg from 'pg';
import { defaultDashboardContent } from '../../data/defaultDashboardContent';
import { deriveDashboardData } from '../../data/dashboardModel';

const { Pool } = pg;
const CONTENT_KEY = 'dashboard';

let pool;

function hydrateContent(content = {}) {
  return {
    ...defaultDashboardContent,
    ...content,
    text: {
      ...defaultDashboardContent.text,
      ...(content.text || {}),
    },
    project: {
      ...defaultDashboardContent.project,
      ...(content.project || {}),
    },
    updateSchedules: Array.isArray(content.updateSchedules)
      ? content.updateSchedules
      : defaultDashboardContent.updateSchedules,
    teams: Array.isArray(content.teams) ? content.teams : defaultDashboardContent.teams,
    dailyWorkInput: Array.isArray(content.dailyWorkInput)
      ? content.dailyWorkInput
      : defaultDashboardContent.dailyWorkInput,
    siteStatuses: Array.isArray(content.siteStatuses)
      ? content.siteStatuses
      : defaultDashboardContent.siteStatuses,
  };
}

function getPool() {
  if (!process.env.DATABASE_URL) {
    return undefined;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }

  return pool;
}

async function ensureContentTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_content (
      key TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function getDashboardContent() {
  const db = getPool();

  if (!db) {
    return hydrateContent();
  }

  const client = await db.connect();

  try {
    await ensureContentTable(client);
    const result = await client.query('SELECT data FROM app_content WHERE key = $1', [CONTENT_KEY]);

    if (result.rowCount === 0) {
      await client.query(
        `INSERT INTO app_content (key, data) VALUES ($1, $2::jsonb)
         ON CONFLICT (key) DO NOTHING`,
        [CONTENT_KEY, JSON.stringify(defaultDashboardContent)],
      );

      return hydrateContent();
    }

    return hydrateContent(result.rows[0].data);
  } catch (error) {
    console.error('Failed to read dashboard content:', error);
    return hydrateContent();
  } finally {
    client.release();
  }
}

export async function saveDashboardContent(content) {
  const db = getPool();

  if (!db) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const client = await db.connect();

  try {
    await ensureContentTable(client);
    await client.query(
      `INSERT INTO app_content (key, data, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (key)
       DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [CONTENT_KEY, JSON.stringify(hydrateContent(content))],
    );
  } finally {
    client.release();
  }

  return hydrateContent(content);
}

export async function getDerivedDashboardData() {
  const content = await getDashboardContent();
  return deriveDashboardData(content);
}
