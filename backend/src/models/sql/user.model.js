import { pool } from '../../config/db.postgres.js';

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
  };
}

export async function findById(id) {
  const result = await pool.query(
    'SELECT * FROM "user" WHERE id = $1',
    [id]
  );
  return mapRow(result.rows[0]);
}