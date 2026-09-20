import { getDatabasePool } from './database';

const DEFAULT_CAPACITY_MB = 500;

function getCapacityBytes() {
  const capacityMb = Number(
    process.env.CLOUD_STORAGE_CAPACITY_MB
      || process.env.RAILWAY_VOLUME_CAPACITY_MB
      || DEFAULT_CAPACITY_MB
  );

  return Math.max(capacityMb, 1) * 1024 * 1024;
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
        pg_database_size(current_database())::bigint AS database_bytes,
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
    const databaseBytes = Number(row.database_bytes || 0);
    const capacityBytes = getCapacityBytes();

    return {
      databaseName: row.database_name || '',
      usedBytes: databaseBytes,
      capacityBytes,
      usedPercent: Math.min(100, Number(((databaseBytes / capacityBytes) * 100).toFixed(2))),
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
