const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  getAttachmentsByTodoId,
  saveAttachment,
  getAttachmentById,
  deleteAttachment,
} = require('./model');

const router = express.Router({ mergeParams: true }); // mergeParams damit wir todoId aus der URL bekommen

// Ordner für Uploads anlegen falls nicht vorhanden
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer-Konfiguration: Dateien auf dem Server speichern
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  // Dateiname: Timestamp + originaler Name, damit keine Konflikte entstehen
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

// Maximale Dateigröße: 50MB
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// GET /todos/:todoId/attachments – alle Anhänge eines Todos laden
router.get('/', async (req, res) => {
  try {
    const attachments = await getAttachmentsByTodoId(req.params.todoId);
    res.json(attachments);
  } catch (err) {
    console.error('Fehler beim Laden der Anhänge:', err);
    res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

// POST /todos/:todoId/attachments – Datei hochladen
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Keine Datei hochgeladen' });
    }

    const attachment = await saveAttachment(
      req.params.todoId,
      req.file.filename,       // gespeicherter Dateiname auf dem Server
      req.file.originalname,   // originaler Dateiname vom User
      req.file.mimetype,
      req.file.size
    );

    res.status(201).json(attachment);
  } catch (err) {
    console.error('Fehler beim Hochladen:', err);
    res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

// GET /todos/:todoId/attachments/:id/download – Datei herunterladen
router.get('/:id/download', async (req, res) => {
  try {
    const attachment = await getAttachmentById(req.params.id);
    if (!attachment) {
      return res.status(404).json({ message: 'Anhang nicht gefunden' });
    }

    const filePath = path.join(UPLOAD_DIR, attachment.filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Datei nicht mehr vorhanden' });
    }

    // Datei mit originalem Namen zum Download anbieten
    res.download(filePath, attachment.originalname);
  } catch (err) {
    console.error('Fehler beim Download:', err);
    res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

// DELETE /todos/:todoId/attachments/:id – Anhang löschen
router.delete('/:id', async (req, res) => {
  try {
    const attachment = await getAttachmentById(req.params.id);
    if (!attachment) {
      return res.status(404).json({ message: 'Anhang nicht gefunden' });
    }

    // Datei vom Server löschen
    const filePath = path.join(UPLOAD_DIR, attachment.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await deleteAttachment(req.params.id);
    res.sendStatus(204);
  } catch (err) {
    console.error('Fehler beim Löschen:', err);
    res.status(500).json({ message: 'Interner Serverfehler' });
  }
});

module.exports = router;