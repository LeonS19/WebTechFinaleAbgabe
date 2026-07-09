import request from 'supertest';
import { app } from '../../src/app.js';
import { generateToken } from '../../src/services/auth/token.service.js';
import { pool } from '../../src/config/db.postgres.js';
import { connectMongo } from '../../src/config/db.mongo.js';
import crypto from 'crypto';

let testUserId;
let testToken;

beforeAll(async () => {
  await connectMongo();

  const userResult = await pool.query(
    'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
    ['Jest GraphQL User', `jest-gql-${Date.now()}@example.com`],
  );
  testUserId = userResult.rows[0].id;
  testToken = generateToken({ userId: testUserId });
});

afterAll(async () => {
  await pool.query('DELETE FROM membership WHERE user_id = $1', [testUserId]);
  await pool.query('DELETE FROM "user" WHERE id = $1', [testUserId]);
  await pool.end();
});

function gqlRequest(query, variables = {}, token = testToken) {
  return request(app)
    .post('/graphql')
    .set('Authorization', token ? `Bearer ${token}` : '')
    .send({ query, variables });
}

describe('GraphQL: createStudyGroup', () => {
  let createdGroupId;

  it('lehnt Mutation ohne Token ab', async () => {
    const res = await gqlRequest(
      `mutation { createStudyGroup(name: "Test") { id } }`,
      {},
      null,
    );

    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toMatch(/authentifiziert/i);
  });

  it('erstellt eine neue Lerngruppe und macht Ersteller zu ADMIN', async () => {
    const res = await gqlRequest(
      `mutation { createStudyGroup(name: "Jest Test Gruppe") { id name } }`,
    );

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.createStudyGroup.name).toBe('Jest Test Gruppe');
    createdGroupId = res.body.data.createStudyGroup.id;

    const membership = await pool.query(
      'SELECT role FROM membership WHERE user_id = $1 AND study_group_id = $2',
      [testUserId, createdGroupId],
    );
    expect(membership.rows[0].role).toBe('ADMIN');
  });

  afterAll(async () => {
    if (createdGroupId) {
      await pool.query('DELETE FROM run WHERE study_group_id = $1', [createdGroupId]);
      await pool.query('DELETE FROM membership WHERE study_group_id = $1', [createdGroupId]);
      await pool.query('DELETE FROM study_group WHERE id = $1', [createdGroupId]);
    }
  });
});

describe('GraphQL: joinStudyGroup / leaveStudyGroup', () => {
  let otherUserId, otherToken;
  let groupId;

  beforeAll(async () => {
    // Ein zweiter User, der der Gruppe beitreten wird
    const result = await pool.query(
      'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
      ['Jest Joiner', `jest-joiner-${Date.now()}@example.com`],
    );
    otherUserId = result.rows[0].id;
    otherToken = generateToken({ userId: otherUserId });

    // Gruppe erstellen (testUserId wird automatisch ADMIN)
    const createRes = await gqlRequest(
      `mutation { createStudyGroup(name: "Jest Join Test Gruppe") { id } }`,
    );
    groupId = createRes.body.data.createStudyGroup.id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM run WHERE study_group_id = $1', [groupId]);
    await pool.query('DELETE FROM membership WHERE study_group_id = $1', [groupId]);
    await pool.query('DELETE FROM study_group WHERE id = $1', [groupId]);
    await pool.query('DELETE FROM "user" WHERE id = $1', [otherUserId]);
  });

  it('erlaubt einem neuen User beizutreten', async () => {
    const res = await gqlRequest(
      `mutation($groupId: ID!) { joinStudyGroup(studyGroupId: $groupId) { role } }`,
      { groupId },
      otherToken,
    );

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.joinStudyGroup.role).toBe('MEMBER');
  });

  it('lehnt doppeltes Beitreten ab', async () => {
    const res = await gqlRequest(
      `mutation($groupId: ID!) { joinStudyGroup(studyGroupId: $groupId) { role } }`,
      { groupId },
      otherToken,
    );

    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toMatch(/bereits Mitglied/i);
  });

  it('erlaubt dem User, die Gruppe zu verlassen', async () => {
    const res = await gqlRequest(
      `mutation($groupId: ID!) { leaveStudyGroup(studyGroupId: $groupId) }`,
      { groupId },
      otherToken,
    );

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.leaveStudyGroup).toBe(true);
  });

  it('lehnt Verlassen einer Gruppe ab, in der man kein Mitglied ist', async () => {
    const res = await gqlRequest(
      `mutation($groupId: ID!) { leaveStudyGroup(studyGroupId: $groupId) }`,
      { groupId },
      otherToken, // hat die Gruppe ja gerade verlassen
    );

    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toMatch(/kein Mitglied/i);
  });
});