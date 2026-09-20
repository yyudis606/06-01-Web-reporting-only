import pg from 'pg';
import tls from 'node:tls';

const { Pool } = pg;

let databasePool;

function getDatabaseConnectionString() {
  const databaseUrl = new URL(process.env.DATABASE_URL);

  ['sslmode', 'sslcert', 'sslkey', 'sslrootcert'].forEach((parameter) => {
    databaseUrl.searchParams.delete(parameter);
  });

  return databaseUrl.toString();
}

function getTlsServername(connectionString) {
  if (process.env.DATABASE_TLS_SERVERNAME) {
    return process.env.DATABASE_TLS_SERVERNAME;
  }

  const databaseUrl = new URL(connectionString);

  if (databaseUrl.hostname.endsWith('.proxy.rlwy.net')) {
    return 'postgres.railway.internal';
  }

  return undefined;
}

function getDatabaseSslConfig(connectionString) {
  const sslMode = (process.env.PGSSLMODE || process.env.DATABASE_SSL_MODE || '').toLowerCase();
  const servername = getTlsServername(connectionString);

  if (sslMode === 'disable') {
    return false;
  }

  const databaseCa = process.env.DATABASE_SSL_CA || process.env.PGSSLROOTCERT_CONTENT;

  if (databaseCa) {
    return {
      ca: databaseCa.replace(/\\n/g, '\n'),
      rejectUnauthorized: true,
      servername,
      checkServerIdentity: servername
        ? (_host, certificate) => tls.checkServerIdentity(servername, certificate)
        : undefined,
    };
  }

  const databaseUrl = new URL(connectionString);
  const isLocalDatabase = ['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname);

  if (isLocalDatabase) {
    return false;
  }

  return {
    rejectUnauthorized: true,
    servername,
    checkServerIdentity: servername
      ? (_host, certificate) => tls.checkServerIdentity(servername, certificate)
      : undefined,
  };
}

export function getDatabasePool() {
  if (!process.env.DATABASE_URL) {
    return undefined;
  }

  if (!databasePool) {
    const connectionString = getDatabaseConnectionString();

    databasePool = new Pool({
      connectionString,
      ssl: getDatabaseSslConfig(connectionString),
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  return databasePool;
}
