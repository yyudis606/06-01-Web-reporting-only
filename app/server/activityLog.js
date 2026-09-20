import { getDatabasePool } from './database';

const MAX_ACTIVITY_ROWS = 5000;

async function ensureActivityLogTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS admin_activity_logs (
      id BIGSERIAL PRIMARY KEY,
      actor_user_id TEXT,
      actor_username TEXT NOT NULL,
      actor_roles TEXT[] NOT NULL DEFAULT '{}',
      action TEXT NOT NULL,
      target TEXT,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS admin_activity_logs_created_at_idx
    ON admin_activity_logs (created_at DESC)
  `);
}

function getRequestMeta(request) {
  const forwardedFor = request.headers.get('x-forwarded-for') || '';
  const ipAddress = forwardedFor.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || '';

  return {
    ipAddress,
    userAgent: request.headers.get('user-agent') || '',
  };
}

export async function recordActivity({
  request,
  actorUserId = '',
  actorUsername,
  actorRoles = [],
  action,
  target = '',
  details = {},
}) {
  const db = getDatabasePool();

  if (!db || !actorUsername || !action) {
    return;
  }

  const client = await db.connect();

  try {
    const meta = getRequestMeta(request);

    await ensureActivityLogTable(client);
    await client.query(
      `INSERT INTO admin_activity_logs
        (actor_user_id, actor_username, actor_roles, action, target, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
      [
        actorUserId || null,
        actorUsername,
        actorRoles,
        action,
        target || null,
        JSON.stringify(details),
        meta.ipAddress || null,
        meta.userAgent || null,
      ],
    );

    await client.query(
      `DELETE FROM admin_activity_logs
       WHERE id NOT IN (
         SELECT id FROM admin_activity_logs
         ORDER BY created_at DESC
         LIMIT $1
       )`,
      [MAX_ACTIVITY_ROWS],
    );
  } catch (error) {
    console.error('Failed to record activity log:', error);
  } finally {
    client.release();
  }
}

export function recordAdminActivity(request, admin, action, target = '', details = {}) {
  return recordActivity({
    request,
    actorUserId: admin.summary.id,
    actorUsername: admin.summary.displayName || admin.summary.username,
    actorRoles: admin.summary.roles,
    action,
    target,
    details,
  });
}

export async function listActivityLogs(limit = 100) {
  const db = getDatabasePool();

  if (!db) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const client = await db.connect();

  try {
    await ensureActivityLogTable(client);
    const result = await client.query(
      `SELECT
        id,
        actor_user_id AS "actorUserId",
        actor_username AS "actorUsername",
        actor_roles AS "actorRoles",
        action,
        target,
        details,
        ip_address AS "ipAddress",
        user_agent AS "userAgent",
        created_at AS "createdAt"
       FROM admin_activity_logs
       ORDER BY created_at DESC
       LIMIT $1`,
      [safeLimit],
    );

    return result.rows;
  } finally {
    client.release();
  }
}

export async function clearActivityLogs() {
  const db = getDatabasePool();

  if (!db) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const client = await db.connect();

  try {
    await ensureActivityLogTable(client);
    const result = await client.query('DELETE FROM admin_activity_logs');
    return result.rowCount;
  } finally {
    client.release();
  }
}
