import request from 'supertest';
import { app } from '../../src/app.js';
import { generateToken } from '../../src/services/auth/token.service.js';
import { pool } from '../../src/config/db.postgres.js';
import { connectMongo } from '../../src/config/db.mongo.js';
import { IndexCard } from '../../src/models/mongo/indexCard.model.js';
import crypto from 'crypto';

let testUserId, testToken, testStudyGroupId;
const createdCardIds = [];

function gqlRequest(query, variables = {}, token = testToken) {
  return request(app)
    .post('/graphql')
    .set('Authorization', token ? `Bearer ${token}` : '')
    .send({ query, variables });
}

beforeAll(async () => {
  await connectMongo();

  const userResult = await pool.query(
    'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
    ['Jest Run User', `jest-run-${Date.now()}@example.com`],
  );
  testUserId = userResult.rows[0].id;
  testToken = generateToken({ userId: testUserId });

  const groupResult = await pool.query(
    'INSERT INTO study_group (name, chat_id) VALUES ($1, $2) RETURNING id',
    ['Jest Run Gruppe', crypto.randomUUID()],
  );
  testStudyGroupId = groupResult.rows[0].id;

  await pool.query(
    'INSERT INTO membership (user_id, study_group_id, role) VALUES ($1, $2, $3)',
    [testUserId, testStudyGroupId, 'ADMIN'],
  );

  // Mindestens 5 Karten nötig (Guard in startRun)
  for (let i = 0; i < 5; i++) {
    const card = await IndexCard.create({
      study_group_id: testStudyGroupId,
      creator_id: testUserId,
      question: `Jest Run Test Frage ${i}`,
      answer: `Antwort${i}`,
    });
    createdCardIds.push(card._id.toString());
  }
});

afterAll(async () => {
  await IndexCard.deleteMany({ _id: { $in: createdCardIds } });
  await pool.query('DELETE FROM run WHERE study_group_id = $1', [testStudyGroupId]);
  await pool.query('DELETE FROM membership WHERE study_group_id = $1', [testStudyGroupId]);
  await pool.query('DELETE FROM study_group WHERE id = $1', [testStudyGroupId]);
  await pool.query('DELETE FROM "user" WHERE id = $1', [testUserId]);
  await pool.end();
});

////////////////////////
//  GetMap und startRun
////////////////////////
describe('GraphQL: getMap', () => {
  it('liefert die hardcoded Map mit Feldern', async () => {
    const res = await gqlRequest(`query { getMap { name fields { position type nextFields } } }`);

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.getMap.fields.length).toBeGreaterThan(0);
  });
});

describe('GraphQL: startRun', () => {
  it('lehnt Start ab, wenn Lerngruppe weniger als 5 Karten hat', async () => {
    // Eigene, kartenlose Gruppe für diesen Test
    const emptyGroupResult = await pool.query(
      'INSERT INTO study_group (name, chat_id) VALUES ($1, $2) RETURNING id',
      ['Jest Leere Gruppe', crypto.randomUUID()],
    );
    const emptyGroupId = emptyGroupResult.rows[0].id;
    await pool.query(
      'INSERT INTO membership (user_id, study_group_id, role) VALUES ($1, $2, $3)',
      [testUserId, emptyGroupId, 'ADMIN'],
    );

    const res = await gqlRequest(
      `mutation($groupId: ID!) { startRun(studyGroupId: $groupId, selectedStartFieldPosition: 0) { id } }`,
      { groupId: emptyGroupId },
    );

    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toMatch(/mindestens/i);

    await pool.query('DELETE FROM membership WHERE study_group_id = $1', [emptyGroupId]);
    await pool.query('DELETE FROM study_group WHERE id = $1', [emptyGroupId]);
  });

  it('startet einen Run erfolgreich mit korrektem Startzustand', async () => {
    const res = await gqlRequest(
      `mutation($groupId: ID!) {
        startRun(studyGroupId: $groupId, selectedStartFieldPosition: 0) {
          id
          currentPosition
          successful
          player { level maxHealth currentHealth }
          deck { id }
        }
      }`,
      { groupId: testStudyGroupId },
    );

    expect(res.body.errors).toBeUndefined();
    const run = res.body.data.startRun;
    expect(run.currentPosition).toBe(0);
    expect(run.successful).toBeNull();
    expect(run.player).toEqual({ level: 1, maxHealth: 100, currentHealth: 100 });
    expect(run.deck.length).toBeGreaterThan(0);
  });

  it('gibt bei erneutem Aufruf den bestehenden aktiven Run zurück (idempotent)', async () => {
    const res = await gqlRequest(
      `mutation($groupId: ID!) { startRun(studyGroupId: $groupId, selectedStartFieldPosition: 1) { id currentPosition } }`,
      { groupId: testStudyGroupId },
    );

    expect(res.body.errors).toBeUndefined();
    // Position bleibt 0 (vom vorherigen Run), NICHT 1 - beweist Idempotenz
    expect(res.body.data.startRun.currentPosition).toBe(0);
  });
});


////////////////////////
//  moveToField und answerCard
////////////////////////
describe('GraphQL: moveToField / answerCard', () => {
  let runId;

  beforeAll(async () => {
    // Frischen Run für diesen Testblock starten
    const startRes = await gqlRequest(
      `mutation($groupId: ID!) { startRun(studyGroupId: $groupId, selectedStartFieldPosition: 0) { id } }`,
      { groupId: testStudyGroupId },
    );
    runId = startRes.body.data.startRun.id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM run WHERE id = $1', [runId]);
  });

  it('bewegt den Spieler zu einem FIGHT-Feld und startet einen Kampf', async () => {
    const res = await gqlRequest(
      `mutation($runId: ID!) {
        moveToField(runId: $runId, targetPosition: 4) {
          run { currentPosition }
          combat { isPlayerTurn status hand { id } enemy { currentHealth } }
        }
      }`,
      { runId },
    );

    expect(res.body.errors).toBeUndefined();
    const result = res.body.data.moveToField;
    expect(result.run.currentPosition).toBe(4);
    expect(result.combat).not.toBeNull();
    expect(result.combat.status).toBe('ACTIVE');
    expect(result.combat.hand.length).toBeGreaterThan(0);
  });

  it('lehnt Bewegung zu einem nicht erreichbaren Feld ab', async () => {
    const res = await gqlRequest(
      `mutation($runId: ID!) { moveToField(runId: $runId, targetPosition: 60) { run { currentPosition } } }`,
      { runId },
    );

    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toMatch(/nicht erreichbar/i);
  });

  it('beantwortet eine Karte korrekt und verursacht Schaden', async () => {
    // Aktuelle Hand holen
    const activeRunRes = await gqlRequest(
      `query($groupId: ID!) { getActiveRun(studyGroupId: $groupId) { activeCombat { hand { id answer } } } }`,
      { groupId: testStudyGroupId },
    );
    const hand = activeRunRes.body.data.getActiveRun.activeCombat.hand;
    const firstCard = hand[0];

    const res = await gqlRequest(
      `mutation($runId: ID!, $cardId: ID!, $answer: String!) {
        answerCard(runId: $runId, cardId: $cardId, userAnswer: $answer) {
          correct
          damageDealt
          combat { hand { id } }
        }
      }`,
      { runId, cardId: firstCard.id, answer: firstCard.answer },
    );

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.answerCard.correct).toBe(true);
    expect(res.body.data.answerCard.damageDealt).toBeGreaterThan(0);
  });

  it('lehnt Beantworten einer Karte ab, die nicht in der Hand ist', async () => {
    const res = await gqlRequest(
      `mutation($runId: ID!) {
        answerCard(runId: $runId, cardId: "000000000000000000000000", userAnswer: "irgendwas") {
          correct
        }
      }`,
      { runId },
    );

    expect(res.body.errors).toBeDefined();
    expect(res.body.errors[0].message).toMatch(/nicht in deiner Hand/i);
  });
});