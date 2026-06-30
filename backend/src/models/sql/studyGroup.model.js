import { pool } from "../../config/db.postgres.js";

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    chatId: row.chat_id,
    createdAt: row.created_at,
  };
}

export async function findById(id) {
  const result = await pool.query("SELECT * FROM study_group WHERE id = $1", [
    id
  ]);
  return mapRow(result.rows[0]);
}

export async function create(name, chatId) {
  const result = await pool.query(
    "INSERT INTO study_group (name, chat_id) VALUES ($1, $2) RETURNING *",
    [name, chatId]
  );
  return mapRow(result.rows[0]);
}
