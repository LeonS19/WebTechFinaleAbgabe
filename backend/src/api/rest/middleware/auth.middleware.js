import { generateToken, verifyToken } from '../../services/auth/token.service.js'
// TODO Tag 2 – Person A: JWT Token verifizieren und req.user setzen
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if(!authHeader || !authHeader.startsWith('Bearer ')){
    return res.status(401).json({ error: 'Unauthorized', message: 'Kein gültiger Token' });
  }

  const token = authHeader.slice(7);

  try{
    const payload = verifyToken(token);
    req.user = payload;
    next()
  }catch{
    return res.status(401).json({ error: 'Unauthorized', message: 'Kein gültiger Token' });
  }
}
