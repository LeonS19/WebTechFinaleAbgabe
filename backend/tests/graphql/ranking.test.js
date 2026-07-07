import request from 'supertest';
import { app } from '../../src/app.js';
import { generateToken } from '../../src/services/auth/token.service.js';
import { pool } from '../../src/config/db.postgres.js';
import { connectMongo } from '../../src/config/db.mongo.js';
import { Map } from '../../src/models/mongo/map.model.js';
import crypto from 'crypto';

let userAId, userATokenValue, userBId, userBTokenValue, testStudyGroupId;
const createdRunIds = [];

function gqlRequest(query, variables = {}, token = userATokenValue) {
  return request(app)
    .post('/graphql')
    .set('Authorization', token ? `Bearer ${token}` : '')
    .send({ query, variables });
}

beforeAll(async () => {
  await connectMongo();

  const map = await Map.findOne();
  const mapId = map.id.toString();

  const userAResult = await pool.query(
    'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
    ['Jest Ranking A', `jest-rank-a-${Date.now()}@example.com`],
  );
  userAId = userAResult.rows[0].id;
  userATokenValue = generateToken({ userId: userAId });

  const userBResult = await pool.query(
    'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
    ['Jest Ranking B', `jest-rank-b-${Date.now()}@example.com`],
  );
  userBId = userBResult.rows[0].id;
  userBTokenValue = generateToken({ userId: userBId });

  const groupResult = await pool.query(
    'INSERT INTO study_group (name, chat_id) VALUES ($1, $2) RETURNING id',
    ['Jest Ranking Gruppe', crypto.randomUUID()],
  );
  testStudyGroupId = groupResult.rows[0].id;

  await pool.query(
    'INSERT INTO membership (user_id, study_group_id, role) VALUES ($1, $2, $3)',
    [userAId, testStudyGroupId, 'ADMIN'],
  );
  await pool.query(
    'INSERT INTO membership (user_id, study_group_id, role) VALUES ($1, $2, $3)',
    [userBId, testStudyGroupId, 'MEMBER'],
  );

  // Zwei abgeschlossene Runs anlegen, damit die Rangliste was zu sortieren hat
  // User A: 40 richtig, 500s Dauer -> sollte vor User B liegen (mehr richtige Antworten)
  const runA = await pool.query(
    `INSERT INTO run (user_id, study_group_id, map_id, successful, start_time, duration, correct_answers, total_answers, current_position)
     VALUES ($1, $2, $3, true, NOW(), $4, $5, $6, 60) RETURNING id`,
    [userAId, testStudyGroupId, mapId, 500, 40, 45],
  );
  createdRunIds.push(runA.rows[0].id);

  // User B: 30 richtig, 300s Dauer -> weniger richtige Antworten als A, sollte trotzdem hinter A landen
  const runB = await pool.query(
    `INSERT INTO run (user_id, study_group_id, map_id, successful, start_time, duration, correct_answers, total_answers, current_position)
     VALUES ($1, $2, $3, true, NOW(), $4, $5, $6, 60) RETURNING id`,
    [userBId, testStudyGroupId, mapId, 300, 30, 40],
  );
  createdRunIds.push(runB.rows[0].id);
});

afterAll(async () => {
  await pool.query('DELETE FROM run WHERE id = ANY($1)', [createdRunIds]);
  await pool.query('DELETE FROM membership WHERE study_group_id = $1', [testStudyGroupId]);
  await pool.query('DELETE FROM study_group WHERE id = $1', [testStudyGroupId]);
  await pool.query('DELETE FROM "user" WHERE id = ANY($1)', [[userAId, userBId]]);
  await pool.end();
});

describe('GraphQL: getRanking', () => {
  it('sortiert primär nach correctAnswers absteigend', async () => {
    const res = await gqlRequest(
      `query($groupId: ID!) {
        getRanking(studyGroupId: $groupId) {
          rank correctAnswers hitRate duration user { name }
        }
      }`,
      { groupId: testStudyGroupId },
    );

    expect(res.body.errors).toBeUndefined();
    const ranking = res.body.data.getRanking;
    expect(ranking.length).toBe(2);

    // User A (40 richtig) sollte vor User B (30 richtig) liegen, trotz längerer Dauer
    expect(ranking[0].correctAnswers).toBe(40);
    expect(ranking[0].rank).toBe(1);
    expect(ranking[1].correctAnswers).toBe(30);
    expect(ranking[1].rank).toBe(2);
  });

  it('lehnt Zugriff für Nicht-Mitglied ab', async () => {
    const outsiderResult = await pool.query(
      'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
      ['Jest Ranking Outsider', `jest-rank-out-${Date.now()}@example.com`],
    );
    const outsiderToken = generateToken({ userId: outsiderResult.rows[0].id });

    const res = await gqlRequest(
      `query($groupId: ID!) { getRanking(studyGroupId: $groupId) { rank } }`,
      { groupId: testStudyGroupId },
      outsiderToken,
    );

    expect(res.body.errors).toBeDefined();

    await pool.query('DELETE FROM "user" WHERE id = $1', [outsiderResult.rows[0].id]);
  });

  it('berücksichtigt nur erfolgreiche Runs', async () => {
    // Ein gescheiterter Run sollte NICHT in der Rangliste auftauchen
    const map = await Map.findOne();
    const failedRun = await pool.query(
      `INSERT INTO run (user_id, study_group_id, map_id, successful, start_time, duration, correct_answers, total_answers, current_position)
       VALUES ($1, $2, $3, false, NOW(), $4, $5, $6, 10) RETURNING id`,
      [userAId, testStudyGroupId, map.id.toString(), 100, 5, 10],
    );
    createdRunIds.push(failedRun.rows[0].id);

    const res = await gqlRequest(
      `query($groupId: ID!) { getRanking(studyGroupId: $groupId) { correctAnswers } }`,
      { groupId: testStudyGroupId },
    );

    // Immer noch nur 2 Einträge (die beiden erfolgreichen), nicht 3
    expect(res.body.data.getRanking.length).toBe(2);
  });
});

describe('GraphQL: getRanking - Tiebreaker-Regeln', () => {
  let tiebreakGroupId;
  const tiebreakRunIds = [];
  let userCId, userCToken, userDId, userDToken;

  beforeAll(async () => {
    const map = await Map.findOne();
    const mapId = map.id.toString();

    const groupResult = await pool.query(
      'INSERT INTO study_group (name, chat_id) VALUES ($1, $2) RETURNING id',
      ['Jest Tiebreak Gruppe', crypto.randomUUID()],
    );
    tiebreakGroupId = groupResult.rows[0].id;

    const userCResult = await pool.query(
      'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
      ['Jest Tiebreak C', `jest-tie-c-${Date.now()}@example.com`],
    );
    userCId = userCResult.rows[0].id;
    userCToken = generateToken({ userId: userCId });

    const userDResult = await pool.query(
      'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
      ['Jest Tiebreak D', `jest-tie-d-${Date.now()}@example.com`],
    );
    userDId = userDResult.rows[0].id;
    userDToken = generateToken({ userId: userDId });

    await pool.query(
      'INSERT INTO membership (user_id, study_group_id, role) VALUES ($1, $2, $3)',
      [userCId, tiebreakGroupId, 'ADMIN'],
    );
    await pool.query(
      'INSERT INTO membership (user_id, study_group_id, role) VALUES ($1, $2, $3)',
      [userDId, tiebreakGroupId, 'MEMBER'],
    );

    // Gleiche correctAnswers (30), aber unterschiedliche totalAnswers -> unterschiedliche hitRate
    // C: 30/30 = 100% hitRate
    const runC = await pool.query(
      `INSERT INTO run (user_id, study_group_id, map_id, successful, start_time, duration, correct_answers, total_answers, current_position)
       VALUES ($1, $2, $3, true, NOW(), $4, $5, $6, 60) RETURNING id`,
      [userCId, tiebreakGroupId, mapId, 400, 30, 30],
    );
    tiebreakRunIds.push(runC.rows[0].id);

    // D: 30/50 = 60% hitRate (gleiche correctAnswers wie C, aber schlechtere hitRate)
    const runD = await pool.query(
      `INSERT INTO run (user_id, study_group_id, map_id, successful, start_time, duration, correct_answers, total_answers, current_position)
       VALUES ($1, $2, $3, true, NOW(), $4, $5, $6, 60) RETURNING id`,
      [userDId, tiebreakGroupId, mapId, 200, 30, 50],
    );
    tiebreakRunIds.push(runD.rows[0].id);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM run WHERE id = ANY($1)', [tiebreakRunIds]);
    await pool.query('DELETE FROM membership WHERE study_group_id = $1', [tiebreakGroupId]);
    await pool.query('DELETE FROM study_group WHERE id = $1', [tiebreakGroupId]);
    await pool.query('DELETE FROM "user" WHERE id = ANY($1)', [[userCId, userDId]]);
  });

  it('nutzt hitRate als Tiebreaker bei gleicher correctAnswers-Zahl', async () => {
    const res = await gqlRequest(
      `query($groupId: ID!) { getRanking(studyGroupId: $groupId) { rank correctAnswers hitRate user { name } } }`,
      { groupId: tiebreakGroupId },
      userCToken,
    );

    const ranking = res.body.data.getRanking;
    expect(ranking[0].correctAnswers).toBe(30);
    expect(ranking[1].correctAnswers).toBe(30);
    // C hat 100% hitRate, sollte trotz gleicher correctAnswers vor D (60%) liegen
    expect(ranking[0].user.name).toBe('Jest Tiebreak C');
    expect(ranking[0].hitRate).toBeGreaterThan(ranking[1].hitRate);
  });
});

describe('GraphQL: getRanking - duration als letzter Tiebreaker', () => {
  let durationGroupId;
  const durationRunIds = [];
  let userEId, userEToken, userFId, userFToken;

  beforeAll(async () => {
    const map = await Map.findOne();
    const mapId = map.id.toString();

    const groupResult = await pool.query(
      'INSERT INTO study_group (name, chat_id) VALUES ($1, $2) RETURNING id',
      ['Jest Duration Gruppe', crypto.randomUUID()],
    );
    durationGroupId = groupResult.rows[0].id;

    const userEResult = await pool.query(
      'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
      ['Jest Duration E', `jest-dur-e-${Date.now()}@example.com`],
    );
    userEId = userEResult.rows[0].id;
    userEToken = generateToken({ userId: userEId });

    const userFResult = await pool.query(
      'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
      ['Jest Duration F', `jest-dur-f-${Date.now()}@example.com`],
    );
    userFId = userFResult.rows[0].id;
    userFToken = generateToken({ userId: userFId });

    await pool.query(
      'INSERT INTO membership (user_id, study_group_id, role) VALUES ($1, $2, $3)',
      [userEId, durationGroupId, 'ADMIN'],
    );
    await pool.query(
      'INSERT INTO membership (user_id, study_group_id, role) VALUES ($1, $2, $3)',
      [userFId, durationGroupId, 'MEMBER'],
    );

    // Identische correctAnswers UND totalAnswers -> identische hitRate,
    // einziger Unterschied ist duration -> muss den Ausschlag geben
    // E: schneller (300s)
    const runE = await pool.query(
      `INSERT INTO run (user_id, study_group_id, map_id, successful, start_time, duration, correct_answers, total_answers, current_position)
       VALUES ($1, $2, $3, true, NOW(), $4, $5, $6, 60) RETURNING id`,
      [userEId, durationGroupId, mapId, 300, 30, 30],
    );
    durationRunIds.push(runE.rows[0].id);

    // F: langsamer (600s), aber gleiche correctAnswers/totalAnswers wie E
    const runF = await pool.query(
      `INSERT INTO run (user_id, study_group_id, map_id, successful, start_time, duration, correct_answers, total_answers, current_position)
       VALUES ($1, $2, $3, true, NOW(), $4, $5, $6, 60) RETURNING id`,
      [userFId, durationGroupId, mapId, 600, 30, 30],
    );
    durationRunIds.push(runF.rows[0].id);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM run WHERE id = ANY($1)', [durationRunIds]);
    await pool.query('DELETE FROM membership WHERE study_group_id = $1', [durationGroupId]);
    await pool.query('DELETE FROM study_group WHERE id = $1', [durationGroupId]);
    await pool.query('DELETE FROM "user" WHERE id = ANY($1)', [[userEId, userFId]]);
  });

  it('nutzt duration als Tiebreaker bei gleicher correctAnswers UND hitRate (schnellere Zeit gewinnt)', async () => {
    const res = await gqlRequest(
      `query($groupId: ID!) { getRanking(studyGroupId: $groupId) { rank correctAnswers hitRate duration user { name } } }`,
      { groupId: durationGroupId },
      userEToken,
    );

    const ranking = res.body.data.getRanking;
    expect(ranking.length).toBe(2);

    // Gleiche correctAnswers und hitRate bei beiden
    expect(ranking[0].correctAnswers).toBe(ranking[1].correctAnswers);
    expect(ranking[0].hitRate).toBe(ranking[1].hitRate);

    // E (300s) sollte vor F (600s) liegen - schnellere Zeit gewinnt (duration ASC)
    expect(ranking[0].user.name).toBe('Jest Duration E');
    expect(ranking[0].duration).toBeLessThan(ranking[1].duration);
    expect(ranking[0].rank).toBe(1);
    expect(ranking[1].rank).toBe(2);
  });
});

describe('GraphQL: getRanking - geteilte Plätze bei komplettem Gleichstand', () => {
  let tiedGroupId;
  const tiedRunIds = [];
  let userGId, userGToken, userHId, userHToken, userIId, userIToken;

  beforeAll(async () => {
    const map = await Map.findOne();
    const mapId = map.id.toString();

    const groupResult = await pool.query(
      'INSERT INTO study_group (name, chat_id) VALUES ($1, $2) RETURNING id',
      ['Jest Tied Gruppe', crypto.randomUUID()],
    );
    tiedGroupId = groupResult.rows[0].id;

    async function createMemberWithRun(name, correctAnswers, totalAnswers, duration, role) {
      const userResult = await pool.query(
        'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
        [name, `${name.toLowerCase().replace(/\s/g, '-')}-${Date.now()}@example.com`],
      );
      const userId = userResult.rows[0].id;
      const token = generateToken({ userId });

      await pool.query(
        'INSERT INTO membership (user_id, study_group_id, role) VALUES ($1, $2, $3)',
        [userId, tiedGroupId, role],
      );

      const runResult = await pool.query(
        `INSERT INTO run (user_id, study_group_id, map_id, successful, start_time, duration, correct_answers, total_answers, current_position)
         VALUES ($1, $2, $3, true, NOW(), $4, $5, $6, 60) RETURNING id`,
        [userId, tiedGroupId, mapId, duration, correctAnswers, totalAnswers],
      );
      tiedRunIds.push(runResult.rows[0].id);

      return { userId, token };
    }

    // G und H: komplett identisch (30 richtig, 30 gesamt, 400s)
    const g = await createMemberWithRun('Jest Tied G', 30, 30, 400, 'ADMIN');
    userGId = g.userId;
    userGToken = g.token;

    const h = await createMemberWithRun('Jest Tied H', 30, 30, 400, 'MEMBER');
    userHId = h.userId;
    userHToken = h.token;

    // I: eindeutig schlechter, sollte auf Platz 3 landen (Lücke wegen geteiltem Platz 1)
    const i = await createMemberWithRun('Jest Tied I', 20, 30, 500, 'MEMBER');
    userIId = i.userId;
    userIToken = i.token;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM run WHERE id = ANY($1)', [tiedRunIds]);
    await pool.query('DELETE FROM membership WHERE study_group_id = $1', [tiedGroupId]);
    await pool.query('DELETE FROM study_group WHERE id = $1', [tiedGroupId]);
    await pool.query('DELETE FROM "user" WHERE id = ANY($1)', [[userGId, userHId, userIId]]);
  });

  it('vergibt bei komplettem Gleichstand denselben Rang, mit Lücke danach', async () => {
    const res = await gqlRequest(
      `query($groupId: ID!) { getRanking(studyGroupId: $groupId) { rank correctAnswers user { name } } }`,
      { groupId: tiedGroupId },
      userGToken,
    );

    const ranking = res.body.data.getRanking;
    expect(ranking.length).toBe(3);

    const gEntry = ranking.find((r) => r.user.name === 'Jest Tied G');
    const hEntry = ranking.find((r) => r.user.name === 'Jest Tied H');
    const iEntry = ranking.find((r) => r.user.name === 'Jest Tied I');

    // G und H teilen sich Platz 1
    expect(gEntry.rank).toBe(1);
    expect(hEntry.rank).toBe(1);

    // I ist eindeutig Dritter (Lücke bei Platz 2, weil zwei Leute Platz 1 belegen)
    expect(iEntry.rank).toBe(3);
  });
});