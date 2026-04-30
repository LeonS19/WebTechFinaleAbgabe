const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'todoapp',
  password: 'postgres',
  port: 5432,
});

const initializeDatabase = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      completed BOOLEAN DEFAULT false,
      "dueDate" DATE,
      "createDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      "editedDate" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      priority INTEGER NOT NULL CHECK (priority IN (1, 2, 3))
    );
  `;
  try {
    await pool.query(createTableQuery);
    console.log('Datenbank-Tabelle "todos" erfolgreich geprüft/erstellt.');
  } catch (err) {
    console.error('Fehler bei der Initialisierung der Datenbank:', err);
    process.exit(1); // Beendet die Anwendung bei einem DB-Fehler
  }
};

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool: pool,
  initializeDatabase,
};