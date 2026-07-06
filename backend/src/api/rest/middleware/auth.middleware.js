import { generateToken, verifyToken } from '../../../services/auth/token.service.js'
const BEARER_PREFIX = 'Bearer ';
const BEARER_PREFIX_LENGTH = BEARER_PREFIX.length
/**
 * Express-Middleware zur JWT-Authentifizierung.
 * 
 * Prüft bei jedem Request an geschützten Routen ob ein gültiges JWT
 * im Authorization-Header mitgeschickt wurde. Bei Erfolg wird die
 * decodierte Payload (mit userId etc.) an req.user gehängt, damit
 * nachfolgende Controller wissen welcher User die Anfrage stellt.
 * 
 * Erwartet: Authorization: Bearer <token>
 * 
 * Bei fehlendem oder ungültigem Token → 401 Unauthorized.
 * Bei gültigem Token → req.user gesetzt, next() aufgerufen.
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if(!authHeader || !authHeader.startsWith('Bearer ')){
    return res.status(401).json({ error: 'Unauthorized', message: 'Kein gültiger Token' });
  }

  const token = authHeader.slice(BEARER_PREFIX_LENGTH);

  try{
    const payload = verifyToken(token);
    req.user = payload;
    next()
  }catch{
    return res.status(401).json({ error: 'Unauthorized', message: 'Kein gültiger Token' });
  }
}
