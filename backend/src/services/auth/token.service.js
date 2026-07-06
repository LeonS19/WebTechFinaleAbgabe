import { env } from '../../config/env.js';
import jwt from 'jsonwebtoken';
const JWT_SECRET = env.JWT_SECRET

/**
 * Verifiziert ein JWT und gibt die decodierte Payload zurück.
 * 
 * Kein try/catch hier — jwt.verify() wirft bei ungültigem/abgelaufenem
 * Token selbst einen Fehler (JsonWebTokenError), der automatisch nach oben
 * weitergereicht wird. Die authMiddleware fängt diesen Fehler ab.
 * 
 * Gibt zurück: { userId, iat, exp, ... } (die decodierte Payload)
 */
function verifyToken(token){
    return jwt.verify(token, JWT_SECRET)
}

/**
 * Erstellt ein signiertes JWT mit der gegebenen Payload.
 * Synchron — kein Netzwerk-Request, reine Kryptografie im Speicher.
 * 
 * @param payload - z.B. { userId: '...' } oder { userId: '...', email: '...' }
 * @returns JWT-String (Base64url-encoded, drei Teile getrennt durch Punkte)
 */
function generateToken(payload){
    const token = jwt.sign(payload, JWT_SECRET, {expiresIn: env.JWT_EXPIRES_IN})
    return token
}

export {generateToken, verifyToken}