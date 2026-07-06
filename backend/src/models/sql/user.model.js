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

export async function findById(id, client = pool) {
  const result = await client.query(
    'SELECT * FROM "user" WHERE id = $1',
    [id]
  );
  return mapRow(result.rows[0]);
}

export async function findByEmail(email, client = pool) {
  const result = await client.query(
    'SELECT * FROM "user" WHERE email = $1',
    [email]
  );
  return mapRow(result.rows[0]);
}

export async function createUser(name, email, client = pool) {
  const result = await client.query(
    `INSERT INTO "user" (name, email)
    VALUES ($1, $2)
    RETURNING *`,
    [name, email]
  );
  return mapRow(result.rows[0]);
}