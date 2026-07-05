import { pool } from '../config/db.postgres.js';

// snake_case (DB) → camelCase (JS/GraphQL), passend zur RankingEntry-Form aus dem Schema
function mapRankingRow(row) {
  const hitRate = row.total_answers > 0 ? row.correct_answers / row.total_answers : 0;

  return {
    rank: Number(row.rank),
    correctAnswers: row.correct_answers,
    hitRate,
    duration: row.duration,
    isFormerMember: row.membership_user_id === null,
    user: {
      id: row.user_id,
      name: row.user_name,
      email: row.user_email,
      createdAt: row.user_created_at,
    },
    run: {
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
      level: row.level,
      maxHealth: row.max_health,
      currentHealth: row.current_health,
    },
  };
}

/**
 * Rangliste einer Lerngruppe.
 * Berücksichtigt werden alle erfolgreich abgeschlossenen Runs (successful = true)
 * dieser Lerngruppe — auch von Usern, die die Gruppe inzwischen verlassen haben
 * (ihr Account existiert ja weiterhin, nur die Mitgliedschaft nicht mehr).
 * isFormerMember zeigt an, ob die Mitgliedschaft noch besteht (LEFT JOIN membership).
 * Sortierung dreistufig: 1. correctAnswers DESC, 2. hitRate DESC, 3. duration ASC
 */
export async function getRanking(studyGroupId, client = pool) {
  const result = await client.query(
    `SELECT
       run.*,
       "user".name AS user_name,
       "user".email AS user_email,
       "user".created_at AS user_created_at,
       membership.user_id AS membership_user_id,
       ROW_NUMBER() OVER (
         ORDER BY
           run.correct_answers DESC,
           (CASE WHEN run.total_answers > 0
                 THEN run.correct_answers::float / run.total_answers
                 ELSE 0 END) DESC,
           run.duration ASC
       ) AS rank
     FROM run
     INNER JOIN "user"
       ON "user".id = run.user_id
     LEFT JOIN membership
       ON membership.user_id = run.user_id
      AND membership.study_group_id = run.study_group_id
     WHERE run.study_group_id = $1
       AND run.successful = true
     ORDER BY rank ASC`,
    [studyGroupId],
  );

  return result.rows.map(mapRankingRow);
}