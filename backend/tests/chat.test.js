import request from 'supertest';
import { app } from '../src/app.js';
import { generateToken } from '../src/services/auth/token.service.js';
import { pool } from '../src/config/db.postgres.js';
import { connectMongo } from '../src/config/db.mongo.js';
import { Message } from '../src/models/mongo/message.model.js';
import crypto from 'crypto';

let adminUserId, adminToken, memberUserId, memberToken, testStudyGroupId, testChatId;
const createdMessageIds = [];

function gqlRequest(query, variables = {}, token = adminToken) {
  return request(app)
    .post('/graphql')
    .set('Authorization', token ? `Bearer ${token}` : '')
    .send({ query, variables });
}

beforeAll(async () => {
  await connectMongo();

  const adminResult = await pool.query(
    'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
    ['Jest Chat Admin', `jest-chat-admin-${Date.now()}@example.com`],
  );
  adminUserId = adminResult.rows[0].id;
  adminToken = generateToken({ userId: adminUserId });

  const memberResult = await pool.query(
    'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
    ['Jest Chat Member', `jest-chat-member-${Date.now()}@example.com`],
  );
  memberUserId = memberResult.rows[0].id;
  memberToken = generateToken({ userId: memberUserId });

  testChatId = crypto.randomUUID();
  const groupResult = await pool.query(
    'INSERT INTO study_group (name, chat_id) VALUES ($1, $2) RETURNING id',
    ['Jest Chat Gruppe', testChatId],
  );
  testStudyGroupId = groupResult.rows[0].id;

  await pool.query(
    'INSERT INTO membership (user_id, study_group_id, role) VALUES ($1, $2, $3)',
    [adminUserId, testStudyGroupId, 'ADMIN'],
  );
  await pool.query(
    'INSERT INTO membership (user_id, study_group_id, role) VALUES ($1, $2, $3)',
    [memberUserId, testStudyGroupId, 'MEMBER'],
  );

  const message = await Message.create({
    chat_id: testChatId,
    sender_id: adminUserId,
    content: 'Jest Test Nachricht für GraphQL',
  });
  createdMessageIds.push(message._id.toString());
});

afterAll(async () => {
  await Message.deleteMany({ _id: { $in: createdMessageIds } });
  await pool.query('DELETE FROM membership WHERE study_group_id = $1', [testStudyGroupId]);
  await pool.query('DELETE FROM study_group WHERE id = $1', [testStudyGroupId]);
  await pool.query('DELETE FROM "user" WHERE id = ANY($1)', [[adminUserId, memberUserId]]);
  await pool.end();
});

describe('GraphQL: getMessages', () => {
  it('lädt Nachrichten inkl. senderRole für ein Mitglied', async () => {
    const res = await gqlRequest(
      `query($chatId: ID!) {
        getMessages(chatId: $chatId) {
          id content senderRole sender { name }
        }
      }`,
      { chatId: testChatId },
      memberToken,
    );

    expect(res.body.errors).toBeUndefined();
    const messages = res.body.data.getMessages;
    expect(messages.length).toBeGreaterThan(0);

    const testMessage = messages.find((m) => m.content === 'Jest Test Nachricht für GraphQL');
    expect(testMessage).toBeDefined();
    expect(testMessage.senderRole).toBe('ADMIN');
    expect(testMessage.sender.name).toBe('Jest Chat Admin');
  });

  it('lehnt Zugriff durch Nicht-Mitglied ab', async () => {
    const outsiderResult = await pool.query(
      'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
      ['Jest Chat Outsider', `jest-chat-outsider-${Date.now()}@example.com`],
    );
    const outsiderToken = generateToken({ userId: outsiderResult.rows[0].id });

    const res = await gqlRequest(
      `query($chatId: ID!) { getMessages(chatId: $chatId) { id } }`,
      { chatId: testChatId },
      outsiderToken,
    );

    expect(res.body.errors).toBeDefined();

    await pool.query('DELETE FROM "user" WHERE id = $1', [outsiderResult.rows[0].id]);
  });

  it('zeigt "Gelöschter Nutzer" für Nachrichten von nicht mehr existierenden Usern', async () => {
    const ghostMessage = await Message.create({
      chat_id: testChatId,
      sender_id: crypto.randomUUID(), // existiert nirgends in der user-Tabelle
      content: 'Nachricht von gelöschtem User',
    });
    createdMessageIds.push(ghostMessage._id.toString());

    const res = await gqlRequest(
      `query($chatId: ID!) { getMessages(chatId: $chatId) { content sender { name } } }`,
      { chatId: testChatId },
      memberToken,
    );

    expect(res.body.errors).toBeUndefined();
    const ghostEntry = res.body.data.getMessages.find((m) => m.content === 'Nachricht von gelöschtem User');
    expect(ghostEntry.sender.name).toBe('Gelöschter Nutzer');
  });
});