const express = require('express')
const db = require('./db');
const { setupWebSocket, initializeChatTable } = require('./chat');
const cors = require('cors');
const attachmentRouter = require('./attachment');
const { initializeAttachmentTable } = require('./attachment/model');
const path = require('path');
const app = express()
const port = 3000

const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

const todoRouter = require('./todo');

app.use(cors());

app.use(express.json());

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @openapi
 * /:
 *   get:
 *     summary: Root endpoint
 *     responses:
 *       200:
 *         description: Hello World Antwort
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.use('/todos', todoRouter);
app.use('/todos/:todoId/attachments', attachmentRouter);
// Statische Dateien servieren damit Downloads funktionieren
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Server nur starten, wenn die Datei nicht in einem Test importiert wird
// Hier wird geprüft, ob app.js direkt mit dem befehl 'node app.js' gestartet wurde
if (require.main === module) {
  const startApp = async () => {
    try {
      await db.initializeDatabase();
      await initializeChatTable(); //Chat-Tabelle anlegen
      await initializeAttachmentTable();

      // http.createServer statt app.listen, damit WebSocket denselben Port nutzt
      const http = require('http');
      const server = http.createServer(app);
      setupWebSocket(server); // WebSocket an den Server hängen

      server.listen(port, () => {
        console.log(`Server läuft auf Port ${port}`);
      });
    } catch (error) {
      console.error('Fehler beim Starten:', error);
      process.exit(1);
    }
  };
  startApp();
}

module.exports = app;