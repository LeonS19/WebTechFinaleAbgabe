import { checkPermission } from '../src/services/permission.service.js';
import { pool } from '../src/config/db.postgres.js';
import crypto from 'crypto';

let adminUserId, moderatorUserId, memberUserId, outsiderUserId;
let testStudyGroupId;

beforeAll(async () => {
  const groupResult = await pool.query(
    'INSERT INTO study_group (name, chat_id) VALUES ($1, $2) RETURNING id',
    ['Jest Permission Gruppe', crypto.randomUUID()],
  );
  testStudyGroupId = groupResult.rows[0].id;

  async function createUserWithRole(name, role) {
    const userResult = await pool.query(
      'INSERT INTO "user" (name, email) VALUES ($1, $2) RETURNING id',
      [name, `${name.toLowerCase()}-${Date.now()}@example.com`],
    );
    const userId = userResult.rows[0].id;
    if (role) {
      await pool.query(
        'INSERT INTO membership (user_id, study_group_id, role) VALUES ($1, $2, $3)',
        [userId, testStudyGroupId, role],
      );
    }
    return userId;
  }

  adminUserId = await createUserWithRole('Jest Admin', 'ADMIN');
  moderatorUserId = await createUserWithRole('Jest Moderator', 'MODERATOR');
  memberUserId = await createUserWithRole('Jest Member', 'MEMBER');
  outsiderUserId = await createUserWithRole('Jest Outsider', null); // kein Membership-Eintrag
});

afterAll(async () => {
  await pool.query('DELETE FROM membership WHERE study_group_id = $1', [testStudyGroupId]);
  await pool.query('DELETE FROM study_group WHERE id = $1', [testStudyGroupId]);
  await pool.query(
    'DELETE FROM "user" WHERE id = ANY($1)',
    [[adminUserId, moderatorUserId, memberUserId, outsiderUserId]],
  );
  await pool.end();
});

describe('checkPermission', () => {
  it('erlaubt ADMIN Zugriff, wenn ADMIN in requiredRoles ist', async () => {
    await expect(
      checkPermission(adminUserId, testStudyGroupId, ['ADMIN']),
    ).resolves.not.toThrow();
  });

  it('erlaubt MODERATOR Zugriff, wenn ADMIN+MODERATOR erlaubt sind', async () => {
    await expect(
      checkPermission(moderatorUserId, testStudyGroupId, ['ADMIN', 'MODERATOR']),
    ).resolves.not.toThrow();
  });

  it('lehnt MEMBER ab, wenn nur ADMIN+MODERATOR erlaubt sind', async () => {
    await expect(
      checkPermission(memberUserId, testStudyGroupId, ['ADMIN', 'MODERATOR']),
    ).rejects.toThrow('Keine Berechtigung');
  });

  it('erlaubt MEMBER Zugriff, wenn MEMBER explizit erlaubt ist', async () => {
    await expect(
      checkPermission(memberUserId, testStudyGroupId, ['ADMIN', 'MODERATOR', 'MEMBER']),
    ).resolves.not.toThrow();
  });

  it('lehnt Nicht-Mitglied ab (kein Membership-Eintrag)', async () => {
    await expect(
      checkPermission(outsiderUserId, testStudyGroupId, ['ADMIN', 'MODERATOR', 'MEMBER']),
    ).rejects.toThrow('Nicht Mitglied');
  });

  it('lehnt komplett unbekannten User ab', async () => {
    await expect(
      checkPermission('00000000-0000-0000-0000-000000000000', testStudyGroupId, ['ADMIN']),
    ).rejects.toThrow('Nicht Mitglied');
  });

  it('gibt das Membership-Objekt bei Erfolg zurück', async () => {
    const membership = await checkPermission(adminUserId, testStudyGroupId, ['ADMIN']);
    expect(membership.role).toBe('ADMIN');
  });
});