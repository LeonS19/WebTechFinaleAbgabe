import { verifyToken } from '../services/auth/token.service.js';

export async function createContext({ req } = {}) {
  try {
    const authHeader = req?.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null };
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    return {
      user: {
        id: payload.userId,
      }
    };
  } catch {
    return { user: null };
  }
}