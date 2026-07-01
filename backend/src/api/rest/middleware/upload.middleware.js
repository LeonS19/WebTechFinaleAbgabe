import multer from 'multer';
import { env } from '../../../config/env.js'; 
// Wo und wie sollen Dateien gespeichert werden?
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, './uploads'),  // Zielordner
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)  // Dateiname
});

// Maximale Dateigröße aus env
const upload = multer({ 
  storage,
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 }
});

export { upload };