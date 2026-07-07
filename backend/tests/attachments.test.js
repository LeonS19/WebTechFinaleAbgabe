import request from 'supertest';
import { app } from '../src/app.js';
import { generateToken } from '../src/services/auth/token.service.js';
import { pool } from '../src/config/db.postgres.js';
import { connectMongo } from '../src/config/db.mongo.js';
import { IndexCard } from '../src/models/mongo/indexCard.model.js';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let testUserId;
let testToken;
let testStudyGroupId;
let testCardId;

beforeAll(async () => {
  await connectMongo();

  const userResult = await pool.query(
    'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
    ['Jest Attachment Tester', `jest-attach-${Date.now()}@example.com`],
  );
  testUserId = userResult.rows[0].id;
  testToken = generateToken({ userId: testUserId });

  const groupResult = await pool.query(
    'INSERT INTO study_group (name, chat_id) VALUES ($1, $2) RETURNING id',
    ['Jest Attachment Gruppe', crypto.randomUUID()],
  );
  testStudyGroupId = groupResult.rows[0].id;

  await pool.query(
    'INSERT INTO membership (user_id, study_group_id, role) VALUES ($1, $2, $3)',
    [testUserId, testStudyGroupId, 'ADMIN'],
  );

  const card = await IndexCard.create({
    study_group_id: testStudyGroupId,
    creator_id: testUserId,
    question: 'Jest Attachment Test Frage',
    answer: 'Jest Attachment Test Antwort',
  });
  testCardId = card._id.toString();
});

afterAll(async () => {
  await IndexCard.findByIdAndDelete(testCardId);
  await pool.query('DELETE FROM membership WHERE study_group_id = $1', [testStudyGroupId]);
  await pool.query('DELETE FROM study_group WHERE id = $1', [testStudyGroupId]);
  await pool.query('DELETE FROM "user" WHERE id = $1', [testUserId]);
  await pool.end();
});

describe('Datei-Anhänge', () => {
    let uploadedAttachmentId;

    it('lehnt Upload ohne Datei ab (400)', async () => {
        const res = await request(app)
        .post(`/api/v1/index-cards/${testCardId}/attachments`)
        .set('Authorization', `Bearer ${testToken}`);

        expect(res.status).toBe(400);
    });

    it('erlaubt Upload einer Datei (201)', async () => {
        const res = await request(app)
        .post(`/api/v1/index-cards/${testCardId}/attachments`)
        .set('Authorization', `Bearer ${testToken}`)
        .attach('file', Buffer.from('Testinhalt'), 'testdatei.txt');

        expect(res.status).toBe(201);
        expect(res.body.filename).toBe('testdatei.txt');
        uploadedAttachmentId = res.body.id;
    });

    it('listet hochgeladene Anhänge auf (200)', async () => {
        const res = await request(app)
        .get(`/api/v1/index-cards/${testCardId}/attachments`)
        .set('Authorization', `Bearer ${testToken}`);

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(1);
    });

    it('lädt eine existierende Datei herunter (200)', async () => {
        const res = await request(app)
        .get(`/api/v1/index-cards/${testCardId}/attachments/${uploadedAttachmentId}`)
        .set('Authorization', `Bearer ${testToken}`);

        expect(res.status).toBe(200);
    });

    it('lehnt Download einer nicht-existierenden attachmentId ab (404)', async () => {
        const res = await request(app)
        .get(`/api/v1/index-cards/${testCardId}/attachments/000000000000000000000000`)
        .set('Authorization', `Bearer ${testToken}`);

        expect(res.status).toBe(404);
    });

    it('lehnt Zugriff eines fremden Users ab (403)', async () => {
        const fremderUserResult = await pool.query(
        'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
        ['Fremder Jest User', `jest-fremd-${Date.now()}@example.com`],
        );
        const fremderUserId = fremderUserResult.rows[0].id;
        const fremderToken = generateToken({ userId: fremderUserId });

        const res = await request(app)
        .get(`/api/v1/index-cards/${testCardId}/attachments`)
        .set('Authorization', `Bearer ${fremderToken}`);

        expect(res.status).toBe(403);

        await pool.query('DELETE FROM "user" WHERE id = $1', [fremderUserId]);
    });

    it('löscht einen Anhang (200)', async () => {
    const res = await request(app)
        .delete(`/api/v1/index-cards/${testCardId}/attachments/${uploadedAttachmentId}`)
        .set('Authorization', `Bearer ${testToken}`);

    console.log('DELETE Response:', res.status, res.body);

    expect(res.status).toBe(200);
    });

    it('lehnt Löschen durch einfaches MEMBER ab (403)', async () => {
        // Neuen User anlegen, als MEMBER (nicht ADMIN/MODERATOR) zur Gruppe hinzufügen
        const memberResult = await pool.query(
            'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
            ['Jest Member User', `jest-member-${Date.now()}@example.com`],
        );
        const memberUserId = memberResult.rows[0].id;
        const memberToken = generateToken({ userId: memberUserId });

        await pool.query(
            'INSERT INTO membership (user_id, study_group_id, role) VALUES ($1, $2, $3)',
            [memberUserId, testStudyGroupId, 'MEMBER'],
        );

        // Neuen Anhang zum Testen hochladen (der vorherige wurde ja schon gelöscht)
        const uploadRes = await request(app)
            .post(`/api/v1/index-cards/${testCardId}/attachments`)
            .set('Authorization', `Bearer ${testToken}`)
            .attach('file', Buffer.from('Weiterer Testinhalt'), 'member-test.txt');

        const attachmentId = uploadRes.body.id;

        // MEMBER versucht zu löschen
        const res = await request(app)
            .delete(`/api/v1/index-cards/${testCardId}/attachments/${attachmentId}`)
            .set('Authorization', `Bearer ${memberToken}`);

        expect(res.status).toBe(403);

        await pool.query('DELETE FROM membership WHERE user_id = $1', [memberUserId]);
        await pool.query('DELETE FROM "user" WHERE id = $1', [memberUserId]);
    });
});