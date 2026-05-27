const { WebSocketServer } = require('ws');
const db = require('./db');

// Erstellt die chat_messages Tabelle falls sie noch nicht existiert
const initializeChatTable = async () => {
  const query = `
    CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
      username VARCHAR(100) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await db.query(query);
  console.log('Datenbank-Tabelle "chat_messages" erfolgreich geprüft/erstellt.');
};

// Alle bisherigen Nachrichten für ein Todo aus der DB laden
const getMessagesForTodo = async (todoId) => {
  const result = await db.query(
    'SELECT * FROM chat_messages WHERE todo_id = $1 ORDER BY created_at ASC',
    [todoId]
  );
  return result.rows;
};

// Neue Nachricht in die DB speichern
const saveMessage = async (todoId, username, message) => {
  const result = await db.query(
    'INSERT INTO chat_messages (todo_id, username, message) VALUES ($1, $2, $3) RETURNING *',
    [todoId, username, message]
  );
  return result.rows[0];
};

// WebSocket-Server einrichten und an den HTTP-Server hängen
const setupWebSocket = (server) => {
  const wss = new WebSocketServer({ server });

  // clients ist eine Map: todoId -> Set von WebSocket-Verbindungen
  // So können Nachrichten nur an Clients schicken, die dasselbe Todo geöffnet haben
  const rooms = new Map();

  wss.on('connection', (ws) => {
    let currentTodoId = null;

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data);

        // --- Nachrichtentyp: "join" ---
        // Client teilt mit, welches Todo er gerade geöffnet hat
        if (msg.type === 'join') {
          currentTodoId = String(msg.todoId);

          // Raum anlegen falls noch nicht vorhanden
          if (!rooms.has(currentTodoId)) {
            rooms.set(currentTodoId, new Set());
          }
          rooms.get(currentTodoId).add(ws);

          // Bisherige Nachrichten aus der DB laden und an den neuen Client schicken
          const history = await getMessagesForTodo(currentTodoId);
          ws.send(JSON.stringify({ type: 'history', messages: history }));
        }

        // --- Nachrichtentyp: "message" ---
        // Client schickt eine neue Chat-Nachricht
        if (msg.type === 'message' && currentTodoId) {
          const saved = await saveMessage(currentTodoId, msg.username, msg.message);

          // Nachricht an ALLE Clients im selben Raum broadcasten
          const room = rooms.get(currentTodoId);
          if (room) {
            room.forEach((client) => {
              if (client.readyState === 1) { // 1 = OPEN
                client.send(JSON.stringify({ type: 'message', message: saved }));
              }
            });
          }
        }
      } catch (err) {
        console.error('WebSocket Fehler:', err);
      }
    });

    // Wenn ein Client die Verbindung trennt, aus dem Raum entfernen
    ws.on('close', () => {
      if (currentTodoId && rooms.has(currentTodoId)) {
        rooms.get(currentTodoId).delete(ws);
      }
    });
  });

  console.log('WebSocket-Server läuft.');
};

module.exports = { setupWebSocket, initializeChatTable };