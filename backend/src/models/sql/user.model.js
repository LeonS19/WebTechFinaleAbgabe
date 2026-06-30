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

export async function findByEmail(email) {
  const result = await pool.query(
    'SELECT * FROM "user" WHERE email = $1',
    [email]
  );
  return mapRow(result.rows[0]);
}

export async function createUser(name, email) {
  const result = await pool.query(
    `INSERT INTO "user" (name, email)
    VALUES ($1, $2)
    RETURNING *`,
    [name, email]
  );
  return mapRow(result.rows[0]);
}