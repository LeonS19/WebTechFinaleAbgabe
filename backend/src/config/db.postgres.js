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