import { verifyToken } from '../services/auth/token.service.js';

export async function createContext({ req, token: directToken } = {}) {
  try {
    const authHeader = req?.headers?.authorization;
    const token = directToken ?? (authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);
    if (!token) {
      return { user: null };
    }

    const payload = verifyToken(token);

    return {
      user: {
        id: payload.userId,
      }
    };
  } catch (err) {
    console.error('[context] verifyToken failed:', err.message);
    return { user: null };
  }
}