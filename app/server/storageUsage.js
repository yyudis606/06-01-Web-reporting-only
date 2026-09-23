import { getDatabasePool } from './database';

const DEFAULT_CAPACITY_MB = 500;
const RAILWAY_API_URL = 'https://backboard.railway.com/graphql/v2';
const RAILWAY_API_TIMEOUT_MS = 5000;

const VOLUME_USAGE_QUERY = `
  query VolumeUsage($projectId: String!) {
    project(id: $projectId) {
      volumes {
        edges {
          node {
            volumeInstances {
              edges {
                node {
                  sizeMB
                  currentSizeMB
                }
              }
            }
          }
        }
      }
    }
  }
`;

// Ambil kapasitas & pemakaian volume Railway yang SEBENARNYA lewat Railway
// Public API (bukan estimasi dari query SQL). Butuh RAILWAY_PROJECT_TOKEN
// (Project Token, dibuat di Railway Dashboard > Project Settings > Tokens)
// dan RAILWAY_PROJECT_ID di environment variable. Kalau salah satu belum
// diisi, atau Railway API gagal diakses, function ini return null supaya
// caller bisa fallback ke estimasi berbasis SQL.
async function getRailwayVolumeUsage() {
  const projectToken = process.env.RAILWAY_PROJECT_TOKEN;
  const projectId = process.env.RAILWAY_PROJECT_ID;

  if (!projectToken || !projectId) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RAILWAY_API_TIMEOUT_MS);

  try {
    const response = await fetch(RAILWAY_API_URL, {
      method: 'POST',
      headers: {
        'Project-Access-Token': projectToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: VOLUME_USAGE_QUERY,
        variables: { projectId },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Railway API responded with status ${response.status}`);
    }

    const payload = await response.json();

    if (payload.errors?.length) {
      throw new Error(payload.errors[0]?.message || 'Railway API returned an error');
    }

    const volumeInstances = (payload.data?.project?.volumes?.edges || [])
      .flatMap((volumeEdge) => volumeEdge.node?.volumeInstances?.edges || [])
      .map((instanceEdge) => instanceEdge.node)
      .filter(Boolean);

    if (volumeInstances.length === 0) {
      return null;
    }

    const totalSizeMb = volumeInstances.reduce((sum, instance) => sum + (Number(instance.sizeMB) || 0), 0);
    const totalCurrentSizeMb = volumeInstances.reduce(
      (sum, instance) => sum + (Number(instance.currentSizeMB) || 0),
      0
    );

    return {
      usedBytes: Math.round(totalCurrentSizeMb * 1024 * 1024),
      capacityBytes: Math.round(totalSizeMb * 1024 * 1024),
    };
  } catch (error) {
    console.error('Failed to read Railway volume usage:', error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function getFallbackCapacityBytes() {
  const capacityMb = Number(
    process.env.CLOUD_STORAGE_CAPACITY_MB
      || process.env.RAILWAY_VOLUME_CAPACITY_MB
      || DEFAULT_CAPACITY_MB
  );

  return Math.max(capacityMb, 1) * 1024 * 1024;
}

// Estimasi pemakaian disk lewat query SQL, dipakai HANYA sebagai fallback
// kalau Railway API (getRailwayVolumeUsage) tidak bisa diakses. Dijumlah dari
// semua database di instance Postgres ini (bukan cuma database "railway")
// ditambah ukuran WAL log, supaya mendekati angka volume disk sebenarnya.
async function getEstimatedUsage(client) {
  let allDatabasesBytes = 0;
  let walBytes = 0;

  try {
    const allDbResult = await client.query(
      'SELECT COALESCE(sum(pg_database_size(datname)), 0)::bigint AS total_bytes FROM pg_database'
    );
    allDatabasesBytes = Number(allDbResult.rows[0]?.total_bytes || 0);
  } catch (error) {
    console.error('Failed to sum pg_database sizes:', error);
  }

  try {
    const walResult = await client.query(
      'SELECT COALESCE(sum(size), 0)::bigint AS wal_bytes FROM pg_ls_waldir()'
    );
    walBytes = Number(walResult.rows[0]?.wal_bytes || 0);
  } catch (error) {
    console.error('Failed to read WAL directory size:', error);
  }

  if (allDatabasesBytes > 0) {
    return { usedBytes: allDatabasesBytes + walBytes, capacityBytes: getFallbackCapacityBytes() };
  }

  const currentDbResult = await client.query(
    'SELECT pg_database_size(current_database())::bigint AS bytes'
  );

  return {
    usedBytes: Number(currentDbResult.rows[0]?.bytes || 0),
    capacityBytes: getFallbackCapacityBytes(),
  };
}

export async function getStorageUsage() {
  const db = getDatabasePool();

  if (!db) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const client = await db.connect();

  try {
    const result = await client.query(`
      SELECT
        current_database() AS database_name,
        storage_tables.app_content_bytes,
        storage_tables.activity_log_bytes,
        storage_tables.content_rows,
        storage_tables.activity_log_rows
      FROM (
        SELECT
          COALESCE(pg_total_relation_size(to_regclass('public.app_content')), 0)::bigint AS app_content_bytes,
          COALESCE(pg_total_relation_size(to_regclass('public.admin_activity_logs')), 0)::bigint AS activity_log_bytes,
          CASE WHEN to_regclass('public.app_content') IS NULL
            THEN 0
            ELSE (SELECT COUNT(*)::int FROM public.app_content)
          END AS content_rows,
          CASE WHEN to_regclass('public.admin_activity_logs') IS NULL
            THEN 0
            ELSE (SELECT COUNT(*)::int FROM public.admin_activity_logs)
          END AS activity_log_rows
      ) storage_tables
    `);

    const row = result.rows[0] || {};
    const volumeUsage = (await getRailwayVolumeUsage()) || (await getEstimatedUsage(client));
    const { usedBytes, capacityBytes } = volumeUsage;

    return {
      databaseName: row.database_name || '',
      usedBytes,
      capacityBytes,
      usedPercent: Math.min(100, Number(((usedBytes / capacityBytes) * 100).toFixed(2))),
      tables: {
        appContentBytes: Number(row.app_content_bytes || 0),
        activityLogBytes: Number(row.activity_log_bytes || 0),
        contentRows: Number(row.content_rows || 0),
        activityLogRows: Number(row.activity_log_rows || 0),
      },
      maxActivityRows: 5000,
      measuredAt: new Date().toISOString(),
    };
  } finally {
    client.release();
  }
}
