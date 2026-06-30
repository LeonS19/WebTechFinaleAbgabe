import { pool } from '../../config/db.postgres.js';

function mapRow(row) {
  if (!row) return null;
  return {
    userId: row.user_id,        // intern für Resolver, nicht direkt GraphQL-Feld
    studyGroupId: row.study_group_id,
    role: row.role,
    joinedAt: row.joined_at,
  };
}

export async function findByStudyGroup(studyGroupId) {
  const result = await pool.query(
    'SELECT * FROM membership WHERE study_group_id = $1',
    [studyGroupId]
  );
  return result.rows.map(mapRow);
}

export async function create(userId, studyGroupId, role) {
  const result = await pool.query(
    'INSERT INTO membership (user_id, study_group_id, role, joined_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
    [userId, studyGroupId, role]
  );
  return mapRow(result.rows[0]);
}

export async function remove(userId, studyGroupId) {
  const result = await pool.query(
    'DELETE FROM membership WHERE user_id = $1 AND study_group_id = $2',
    [userId, studyGroupId]
  );
  return result.rowCount > 0;
}

export async function findOne(userId, studyGroupId) {
  const result = await pool.query(
    'SELECT * FROM membership WHERE user_id = $1 AND study_group_id = $2',
    [userId, studyGroupId]
  );
  return mapRow(result.rows[0]);
}

export async function updateRole(userId, studyGroupId, role) {
  const result = await pool.query(
    'UPDATE membership SET role = $1 WHERE user_id = $2 AND study_group_id = $3 RETURNING *',
    [role, userId, studyGroupId]
  );
  return mapRow(result.rows[0]);
}