import { pool } from '../../config/db.postgres.js';

// snake_case (DB) → camelCase (JS/GraphQL)
function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    studyGroupId: row.study_group_id,
    mapId: row.map_id,
    successful: row.successful,
    startTime: row.start_time,
    duration: row.duration,
    correctAnswers: row.correct_answers,
    totalAnswers: row.total_answers,
    hitRate: row.total_answers > 0 ? row.correct_answers / row.total_answers : null,
    currentPosition: row.current_position,
    characterId: row.character_id,
    level: row.level,
    maxHealth: row.max_health,
    currentHealth: row.current_health,
  };
}

// nutzen die DB-Defaults (1/100/100) — deshalb hier nicht explizit angeben
export async function createRun(userId, studyGroupId, mapId, startPosition, characterId, client = pool) {
    const run = await client.query(
        `INSERT INTO run (user_id, study_group_id, map_id, current_position, character_id)
        VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [userId, studyGroupId, mapId, startPosition, characterId]
    )
    return mapRow(run.rows[0])
}

// findet einen laufenden Run (successful IS NULL = noch aktiv)
export async function findActiveRunByUser(userId, studyGroupId, client = pool) {
  const result = await client.query(
    `SELECT * FROM run 
     WHERE user_id = $1 AND study_group_id = $2 AND successful IS NULL 
     LIMIT 1`,
    [userId, studyGroupId]
  );
  return mapRow(result.rows[0]);
}


export async function findRunById(runId, client = pool) {
    const run = await client.query(
        'SELECT * FROM run WHERE id = $1',
        [runId]
      );
      return mapRow(run.rows[0]);
}

// Alle Runs eines Users (für getRuns Query / Historie) — über alle Lerngruppen hinweg,
// Filterung nach der aktuell offenen Gruppe passiert im Frontend über run.studyGroup.id
export async function findRunsByUser(userId, client = pool) {
    const runs = await client.query(
        'SELECT * FROM run WHERE user_id = $1 ORDER BY start_time DESC',
        [userId]
      );
      return runs.rows.map(mapRow);
}

// Wird nach jedem Feldwechsel aufgerufen
export async function updatePosition(runId, newPosition, client = pool) {
  const result = await client.query(
    'UPDATE run SET current_position = $1 WHERE id = $2 RETURNING *',
    [newPosition, runId]
  );
  return mapRow(result.rows[0]);
}

// Wird nach jedem answerCard aufgerufen (HP + Zähler ändern sich)
export async function updateHealthAndAnswers(runId, { currentHealth, correctAnswers, totalAnswers }, client = pool) {
  const result = await client.query(
    `UPDATE run 
     SET current_health = $1, correct_answers = $2, total_answers = $3 
     WHERE id = $4 
     RETURNING *`,
    [currentHealth, correctAnswers, totalAnswers, runId]
  );
  return mapRow(result.rows[0]);
}

// Wird nach Kampfsieg aufgerufen (levelUp-Logik aus combat.service.js liefert die neuen Werte)
export async function applyLevelUp(runId, { level, maxHealth, currentHealth }, client = pool) {
    const result = await client.query(
        `UPDATE run 
        SET level = $1, max_health = $2, current_health = $3 
        WHERE id = $4 
        RETURNING *`,
        [level, maxHealth, currentHealth, runId]
    );
    return mapRow(result.rows[0]);
}

// Run beenden — successful + duration setzen
// correct_answers/total_answers stehen schon aktuell in der DB (über updateHealthAndAnswers gepflegt)
export async function endRun(runId, successful, duration, client = pool) {
    const result = await client.query(
        `UPDATE run 
        SET successful = $1, duration = $2
        WHERE id = $3 
        RETURNING *`,
        [successful, duration, runId]
    );
    return mapRow(result.rows[0]);
}