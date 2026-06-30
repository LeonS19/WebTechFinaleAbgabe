import { env } from '../../config/env.js';
import jwt from 'jsonwebtoken';
const JWT_SECRET = env.JWT_SECRET


function verifyToken(token){
    return jwt.verify(token, JWT_SECRET)
}

function generateToken(payload){
    const token = jwt.sign(payload, JWT_SECRET, {expiresIn: env.JWT_EXPIRES_IN})
    return token
}

export {generateToken, verifyToken}