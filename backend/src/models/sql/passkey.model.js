import { pool } from '../../config/db.postgres.js';

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    credentialId: row.credential_id,
    publicKey: row.public_key,
    counter: row.counter,
    deviceName: row.device_name,
    createdAt: row.created_at,
  };
}

export async function createPasskey(userId, credentialId, publicKey, counter, deviceName, client = pool) {
  const result = await client.query(
    `INSERT INTO passkey (user_id, credential_id, public_key, counter, device_name)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, credentialId, publicKey, counter, deviceName]
  );
  return mapRow(result.rows[0]);
}

export async function findPasskeyByCredentialId(credentialId, client = pool) {
  const result = await client.query(
    `SELECT * FROM passkey WHERE credential_id = $1`,
    [credentialId]
  );
  return mapRow(result.rows[0]);
}

export async function findPasskeyById(passkeyId, client = pool) {
  const result = await client.query(
    `SELECT * FROM passkey WHERE id = $1`,
    [passkeyId]
  );
  return mapRow(result.rows[0]);
}

export async function deletePasskey(passkeyId, client = pool) {
  await client.query(
    `DELETE FROM passkey WHERE id = $1`,
    [passkeyId]
  );
}