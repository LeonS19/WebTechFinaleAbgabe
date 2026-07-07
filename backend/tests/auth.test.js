import request from 'supertest';
import { app } from '../src/app.js';
import { generateToken } from '../src/services/auth/token.service.js';
import { IndexCard } from '../src/models/mongo/indexCard.model.js';
import { connectMongo } from '../src/config/db.mongo.js';
import { pool } from '../src/config/db.postgres.js';
import crypto from 'crypto';

let testUserId;
let testToken;

beforeAll(async () => {
    await connectMongo();
  const userResult = await pool.query(
    'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
    ['Jest Test User', `jest-test-${Date.now()}@example.com`],
  );
  testUserId = userResult.rows[0].id;
  testToken = generateToken({ userId: testUserId });

  const groupResult = await pool.query(
    'INSERT INTO study_group (name, chat_id) VALUES ($1, $2) RETURNING id',
    ['Jest Test Gruppe', crypto.randomUUID()],
  );
  testStudyGroupId = groupResult.rows[0].id;

  await pool.query(
    'INSERT INTO membership (user_id, study_group_id, role) VALUES ($1, $2, $3)',
    [testUserId, testStudyGroupId, 'ADMIN'],
  );
});

afterAll(async () => {
  await pool.query('DELETE FROM membership WHERE study_group_id = $1', [testStudyGroupId]);
  await pool.query('DELETE FROM study_group WHERE id = $1', [testStudyGroupId]);
  await pool.query('DELETE FROM "user" WHERE id = $1', [testUserId]);
  await pool.end();
});

describe('Auth Kantenfälle', () => {
  it('lehnt Zugriff auf geschützte Route ohne Token ab (401)', async () => {
    const res = await request(app).get('/api/v1/index-cards/irgendeine-id/attachments');
    expect(res.status).toBe(401);
  });

  it('lehnt Zugriff mit kaputtem Token ab (401)', async () => {
    const res = await request(app)
      .get('/api/v1/index-cards/irgendeine-id/attachments')
      .set('Authorization', 'Bearer kaputter.token.hier');

    expect(res.status).toBe(401);
  });

  it('lehnt Zugriff mit leerem Bearer-Wert ab (401)', async () => {
    const res = await request(app)
      .get('/api/v1/index-cards/irgendeine-id/attachments')
      .set('Authorization', 'Bearer ');

    expect(res.status).toBe(401);
  });

  it('lehnt DELETE auf nicht-existierenden Passkey ab (400)', async () => {
    const res = await request(app)
      .delete('/api/v1/auth/passkey/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(400);
  });

  it('erlaubt berechtigtem User Zugriff auf Anhänge-Liste einer Karte (200)', async () => {
    // Braucht eine echte Karte in MongoDB, die zu testStudyGroupId gehört
    const card = await IndexCard.create({
        study_group_id: testStudyGroupId,
        creator_id: testUserId,
        question: 'Jest Test Frage',
        answer: 'Jest Test Antwort',
    });

    const res = await request(app)
        .get(`/api/v1/index-cards/${card._id}/attachments`)
        .set('Authorization', `Bearer ${testToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);

    await IndexCard.findByIdAndDelete(card._id);
    });
});