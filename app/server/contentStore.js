import { defaultDashboardContent } from '../../data/defaultDashboardContent';
import { deriveDashboardData } from '../../data/dashboardModel';
import { getDatabasePool } from './database';

const CONTENT_KEY = 'dashboard';

// Cache in-memory sederhana supaya banyak request yang datang berdekatan
// (mis. beberapa user membuka dashboard dalam beberapa detik yang sama)
// tidak masing-masing memicu query database + hitung ulang statistik dari nol.
// Cache ini hanya hidup selama instance server (Vercel function) masih "warm",
// dan langsung dihapus setiap kali admin menyimpan perubahan data (lihat
// invalidateContentCache()), jadi perubahan tetap terlihat instan.
const CONTENT_CACHE_TTL_MS = 30 * 1000;
let cachedContent = null;
let cachedContentAt = 0;
let cachedDerivedSource = null;
let cachedDerived = null;

function invalidateContentCache() {
  cachedContent = null;
  cachedContentAt = 0;
  cachedDerivedSource = null;
  cachedDerived = null;
}

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
  if (cachedContent && Date.now() - cachedContentAt < CONTENT_CACHE_TTL_MS) {
    return cachedContent;
  }

  const db = getDatabasePool();

  if (!db) {
    return hydrateContent();
  }

  let client;

  try {
    client = await db.connect();
    await ensureContentTable(client);
    const result = await client.query('SELECT data FROM app_content WHERE key = $1', [CONTENT_KEY]);

    if (result.rowCount === 0) {
      await client.query(
        `INSERT INTO app_content (key, data) VALUES ($1, $2::jsonb)
         ON CONFLICT (key) DO NOTHING`,
        [CONTENT_KEY, JSON.stringify(defaultDashboardContent)],
      );

      cachedContent = hydrateContent();
      cachedContentAt = Date.now();
      return cachedContent;
    }

    cachedContent = hydrateContent(result.rows[0].data);
    cachedContentAt = Date.now();
    return cachedContent;
  } catch (error) {
    console.error('Failed to read dashboard content:', error);
    return hydrateContent();
  } finally {
    client?.release();
  }
}

export async function saveDashboardContent(content) {
  const db = getDatabasePool();

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

  // Perubahan admin harus langsung terlihat, jadi cache dibuang seketika
  // (bukan menunggu TTL) agar request berikutnya membaca data terbaru.
  invalidateContentCache();

  return hydrateContent(content);
}

export async function getDerivedDashboardData() {
  const content = await getDashboardContent();

  // Selama isi konten belum berubah (masih objek cache yang sama persis),
  // hasil perhitungan statistik sebelumnya dipakai ulang tanpa proses lagi.
  if (cachedDerivedSource === content) {
    return cachedDerived;
  }

  const derived = deriveDashboardData(content);
  cachedDerivedSource = content;
  cachedDerived = derived;
  return derived;
}
