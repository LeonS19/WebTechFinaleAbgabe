import { pool } from '../../config/db.postgres.js';

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    providerUserId: row.provider_user_id,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    createdAt: row.created_at,
  };
}

export async function findOAuthAccount(provider, providerUserId) {
    const result = await pool.query(
        'SELECT * FROM oauth_account WHERE provider = $1 AND provider_user_id = $2',
        [provider, providerUserId]
    );
    return mapRow(result.rows[0]);
}

export async function createOAuthAccount(userId, provider, providerUserId, accessToken, refreshToken) {
  const result = await pool.query(
    `INSERT INTO oauth_account (user_id, provider, provider_user_id, access_token, refresh_token)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
    [userId, provider, providerUserId, accessToken, refreshToken]
  );
  return mapRow(result.rows[0]);
}