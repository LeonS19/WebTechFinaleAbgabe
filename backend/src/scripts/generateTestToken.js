// backend/src/scripts/generateTestToken.js
import { generateToken } from '../services/auth/token.service.js';

const userId = process.argv[2]; // ID als Kommandozeilen-Argument übergeben
console.log(generateToken({ userId }));