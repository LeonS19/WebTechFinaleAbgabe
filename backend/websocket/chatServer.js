const { WebSocketServer } = require('ws');
const Message = require('../models/Message');

const rooms = new Map();

function setupChatServer(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: '/chat' });

  wss.on('connection', (ws, req) => {
    // todoId aus URL lesen: /chat?todoId=123
    const url = new URL(req.url, 'http://localhost');
    const todoId = url.searchParams.get('todoId');

    if (!todoId) { ws.close(); return; }

    // Client in den richtigen Raum aufnehmen
    if (!rooms.has(todoId)) rooms.set(todoId, new Set());
    rooms.get(todoId).add(ws);

    // Letzte Nachrichten beim Verbinden schicken
    Message.find({ todoId }).sort({ createdAt: 1 }).limit(50)
      .then(messages => {
        ws.send(JSON.stringify({ type: 'HISTORY', messages }));
      });

    ws.on('message', async (data) => {
      const { author, text } = JSON.parse(data);

      // In DB speichern
      const msg = await Message.create({ todoId, author, text });

      // An alle Clients im selben Raum broadcasten
      const payload = JSON.stringify({ type: 'NEW_MESSAGE', message: msg });
      for (const client of rooms.get(todoId)) {
        if (client.readyState === 1) client.send(payload);
      }
    });

    ws.on('close', () => {
      rooms.get(todoId)?.delete(ws);
    });
  });
}

module.exports = { setupChatServer };