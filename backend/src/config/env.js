import 'dotenv/config';

const required = [
  'POSTGRES_URL',
  'MONGO_URI',
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'WEBAUTHN_RP_ID',
  'WEBAUTHN_ORIGIN',
  'FRONTEND_URL',
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  PORT:                 process.env.PORT || 3000,
  NODE_ENV:             process.env.NODE_ENV || 'development',
  POSTGRES_URL:         process.env.POSTGRES_URL,
  MONGO_URI:            process.env.MONGO_URI,
  JWT_SECRET:           process.env.JWT_SECRET,
  JWT_EXPIRES_IN:       process.env.JWT_EXPIRES_IN || '7d',
  GOOGLE_CLIENT_ID:     process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL:  process.env.GOOGLE_CALLBACK_URL,
  WEBAUTHN_RP_NAME:     process.env.WEBAUTHN_RP_NAME || 'Learning Platform',
  WEBAUTHN_RP_ID:       process.env.WEBAUTHN_RP_ID,
  WEBAUTHN_ORIGIN:      process.env.WEBAUTHN_ORIGIN,
  UPLOAD_DIR:           process.env.UPLOAD_DIR || './uploads',
  MAX_FILE_SIZE_MB:     parseInt(process.env.MAX_FILE_SIZE_MB || '10'),
  FRONTEND_URL:         process.env.FRONTEND_URL,
};
