const express = require('express')
const db = require('./db');
const cors = require('cors');
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

// Server nur starten, wenn die Datei nicht in einem Test importiert wird
// Hier wird geprüft, ob app.js direkt mit dem befehl 'node app.js' gestartet wurde
if (require.main === module) {
  const startApp = async () => {
    try {
      // 1. Warte, bis die Datenbank bereit ist
      await db.initializeDatabase();

      // 2. Starte dann den Express-Server
      app.listen(port, () => {
        console.log(`Example app listening on port ${port}`);
      });
    } catch (error) {
      console.error('Fehler beim Starten der Anwendung:', error);
      process.exit(1);
    }
  };

  startApp();
}

// App für die tests exportieren
module.exports = app;
