const db = require('../db');

// Erstellt die attachments Tabelle falls sie noch nicht existiert
const initializeAttachmentTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS attachments (
      id SERIAL PRIMARY KEY,
      todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      filename VARCHAR(255) NOT NULL,
      originalname VARCHAR(255) NOT NULL,
      mimetype VARCHAR(100) NOT NULL,
      size INTEGER NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await db.query(query);
  console.log('Datenbank-Tabelle "attachments" erfolgreich geprüft/erstellt.');
};

// Alle Anhänge eines Todos laden
const getAttachmentsByTodoId = async (todoId) => {
  const result = await db.query(
    'SELECT * FROM attachments WHERE todo_id = $1 ORDER BY created_at ASC',
    [todoId]
  );
  return result.rows;
};

// Einen neuen Anhang in die DB speichern
const saveAttachment = async (todoId, filename, originalname, mimetype, size) => {
  const result = await db.query(
    'INSERT INTO attachments (todo_id, filename, originalname, mimetype, size) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [todoId, filename, originalname, mimetype, size]
  );
  return result.rows[0];
};

// Einen Anhang anhand seiner ID laden
const getAttachmentById = async (id) => {
  const result = await db.query('SELECT * FROM attachments WHERE id = $1', [id]);
  return result.rows[0] || null;
};

// Einen Anhang löschen
const deleteAttachment = async (id) => {
  const result = await db.query('DELETE FROM attachments WHERE id = $1 RETURNING *', [id]);
  return result.rows[0] || null;
};

module.exports = {
  initializeAttachmentTable,
  getAttachmentsByTodoId,
  saveAttachment,
  getAttachmentById,
  deleteAttachment,
};