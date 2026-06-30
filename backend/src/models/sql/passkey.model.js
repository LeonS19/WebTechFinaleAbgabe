import { pool } from '../../config/db.postgres.js';

export async function createPasskey(userId, credentialId, publicKey, counter, deviceName) {
  const result = await pool.query(
    `INSERT INTO passkey (user_id, credential_id, public_key, counter, device_name)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, credentialId, publicKey, counter, deviceName]
  );
  return result.rows[0];
}

export async function findPasskey(credentialId) {
  const result = await pool.query(
    `SELECT * FROM passkey WHERE credential_id = $1`,
    [credentialId]
  );
  return result.rows[0];
}

export async function deletePasskey(passkeyId) {
  await pool.query(
    `DELETE FROM passkey WHERE id = $1`,
    [passkeyId]
  );
}