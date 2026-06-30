import { pool } from '../../config/db.postgres.js';

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    challenge: row.challenge,
    type: row.type,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export async function createChallenge(userId, challenge, type, expiresAt) {
  const result = await pool.query(
    `INSERT INTO webauthn_challenge (user_id, challenge, type, expires_at)
    VALUES ($1, $2, $3, $4)
    RETURNING *`,
    [userId, challenge, type, expiresAt]
  );
  return mapRow(result.rows[0]);
}

export async function findChallenge(challengeId) {
  const result = await pool.query(
    `SELECT * FROM webauthn_challenge WHERE id = $1`,
    [challengeId]
  );
  return mapRow(result.rows[0]);
}

export async function deleteChallenge(challengeId) {
  await pool.query(
    `DELETE FROM webauthn_challenge WHERE id = $1`,
    [challengeId]
  );
}