import request from 'supertest';
import { app } from '../../src/app.js';
import { generateToken } from '../../src/services/auth/token.service.js';
import { pool } from '../../src/config/db.postgres.js';
import { connectMongo } from '../../src/config/db.mongo.js';
import { IndexCard } from '../../src/models/mongo/indexCard.model.js';
import crypto from 'crypto';

let adminUserId, adminToken, memberUserId, memberToken, testStudyGroupId;
const createdCardIds = [];

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
    ['Jest Card Admin', `jest-card-admin-${Date.now()}@example.com`],
  );
  adminUserId = adminResult.rows[0].id;
  adminToken = generateToken({ userId: adminUserId });

  const memberResult = await pool.query(
    'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
    ['Jest Card Member', `jest-card-member-${Date.now()}@example.com`],
  );
  memberUserId = memberResult.rows[0].id;
  memberToken = generateToken({ userId: memberUserId });

  const groupResult = await pool.query(
    'INSERT INTO study_group (name, chat_id) VALUES ($1, $2) RETURNING id',
    ['Jest Card Gruppe', crypto.randomUUID()],
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
});

afterAll(async () => {
  await IndexCard.deleteMany({ _id: { $in: createdCardIds } });
  await pool.query('DELETE FROM membership WHERE study_group_id = $1', [testStudyGroupId]);
  await pool.query('DELETE FROM study_group WHERE id = $1', [testStudyGroupId]);
  await pool.query('DELETE FROM "user" WHERE id = ANY($1)', [[adminUserId, memberUserId]]);
  await pool.end();
});

describe('GraphQL: createIndexCard', () => {
  it('lehnt Erstellung durch MEMBER ab (nur ADMIN/MODERATOR)', async () => {
    const res = await gqlRequest(
      `mutation($groupId: ID!) {
        createIndexCard(studyGroupId: $groupId, question: "Q?", answer: "A") { id }
      }`,
      { groupId: testStudyGroupId },
      memberToken,
    );

    expect(res.body.errors).toBeDefined();
  });

  it('erlaubt ADMIN das Erstellen einer Karte', async () => {
    const res = await gqlRequest(
      `mutation($groupId: ID!) {
        createIndexCard(studyGroupId: $groupId, question: "Was ist 1+1?", answer: "2", tags: ["mathe"]) {
          id question answer tags
        }
      }`,
      { groupId: testStudyGroupId },
    );

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.createIndexCard.question).toBe('Was ist 1+1?');
    createdCardIds.push(res.body.data.createIndexCard.id);
  });
});

describe('GraphQL: getIndexCards (Filter)', () => {
  beforeAll(async () => {
    const card = await IndexCard.create({
      study_group_id: testStudyGroupId,
      creator_id: adminUserId,
      question: 'Filterbare Testfrage',
      answer: 'Antwort',
      tags: ['filtertest'],
    });
    createdCardIds.push(card._id.toString());
  });

  it('filtert Karten nach Tag', async () => {
    const res = await gqlRequest(
      `query($groupId: ID!, $tags: [String!]) {
        getIndexCards(studyGroupId: $groupId, tags: $tags) { id tags }
      }`,
      { groupId: testStudyGroupId, tags: ['filtertest'] },
    );

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.getIndexCards.length).toBeGreaterThan(0);
    res.body.data.getIndexCards.forEach((c) => {
      expect(c.tags).toContain('filtertest');
    });
  });

  it('lehnt Zugriff durch Nicht-Mitglied ab', async () => {
    const outsiderResult = await pool.query(
      'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
      ['Jest Card Outsider', `jest-card-outsider-${Date.now()}@example.com`],
    );
    const outsiderToken = generateToken({ userId: outsiderResult.rows[0].id });

    const res = await gqlRequest(
      `query($groupId: ID!) { getIndexCards(studyGroupId: $groupId) { id } }`,
      { groupId: testStudyGroupId },
      outsiderToken,
    );

    expect(res.body.errors).toBeDefined();

    await pool.query('DELETE FROM "user" WHERE id = $1', [outsiderResult.rows[0].id]);
  });
});

describe('GraphQL: deleteIndexCard', () => {
  it('lehnt Löschen durch MEMBER ab', async () => {
    const card = await IndexCard.create({
      study_group_id: testStudyGroupId,
      creator_id: adminUserId,
      question: 'Zu löschende Frage',
      answer: 'Antwort',
    });
    createdCardIds.push(card._id.toString());

    const res = await gqlRequest(
      `mutation($id: ID!) { deleteIndexCard(id: $id) }`,
      { id: card._id.toString() },
      memberToken,
    );

    expect(res.body.errors).toBeDefined();
  });

  it('erlaubt ADMIN das Löschen', async () => {
    const card = await IndexCard.create({
      study_group_id: testStudyGroupId,
      creator_id: adminUserId,
      question: 'Wird gelöscht',
      answer: 'Antwort',
    });

    const res = await gqlRequest(
      `mutation($id: ID!) { deleteIndexCard(id: $id) }`,
      { id: card._id.toString() },
    );

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.deleteIndexCard).toBe(true);

    const stillExists = await IndexCard.findById(card._id);
    expect(stillExists).toBeNull();
  });
});