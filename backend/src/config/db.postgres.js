import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.POSTGRES_URL,
});

export async function connectPostgres() {
  const client = await pool.connect();
  console.log('PostgreSQL connected');
  client.release();
}

/**
 * Führt eine Funktion in einer DB-Transaktion aus.
 * Bei Fehler wird automatisch ROLLBACK gemacht.
 * 
 * @param fn - async Funktion die einen pg-Client bekommt
 * @example
 * await withTransaction(async (client) => {
 *   await client.query('INSERT INTO ...');
 *   await client.query('INSERT INTO ...');
 * });
 */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}