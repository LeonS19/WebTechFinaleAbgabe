import { Combat } from "../models/mongo/combat.model.js";
import { getMap } from "./map.service.js";
import {
  drawCards,
  discardCard,
  reshuffleDiscardIntoDeck,
  findRunDeck,
  returnCardsToDeck,
} from "./runDeck.service.js";
import {
  findRunById,
  updateHealthAndAnswers,
  applyLevelUp,
  endRun as endRunModel,
} from "../models/sql/run.model.js";
import * as IndexCardService from "./indexCard.service.js";
import {
  takeDamage,
  heal,
  levelUp,
  calculateDamageMultiplier,
} from "./utils/playerStats.util.js";

// ==================== Private Hilfsfunktionen (Kampf-Mathematik) ====================

const CARD_DIFFICULTY_MIN_ATTEMPTS = 10;
const DEFAULT_CARD_DAMAGE = 3;
const HAND_SIZE = 5;

// Kartenschaden 1–5, basierend auf Gruppen-Schwierigkeit (Cold-Start-Schutz ab 10 Versuchen)
function calculateCardDamage(card, studyGroupId) {
  const groupStat = card.group_stats.find(
    (s) => s.study_group_id === studyGroupId,
  );

  if (!groupStat || groupStat.total_attempts < CARD_DIFFICULTY_MIN_ATTEMPTS) {
    return DEFAULT_CARD_DAMAGE;
  }

  const difficulty = groupStat.correct_answers / groupStat.total_attempts;
  return Math.round(1 + (1 - difficulty) * 4);
}

//Hilfsfunktion für Zugende-Ziehlogik
async function drawForNextTurn(runId, count, currentHandSize) {
  const runDeck = await findRunDeck(runId);

  const deckIsEmpty = runDeck.deck.length === 0;
  const handIsEmpty = currentHandSize === 0;

  if (deckIsEmpty && handIsEmpty) {
    await reshuffleDiscardIntoDeck(runId);
  }

  return await drawCards(runId, count);
}

function calculateDuration(startTime) {
  return Math.round((Date.now() - new Date(startTime).getTime()) / 1000);
}

// ==================== Private DB-Zugriffsfunktionen (Combat-Dokument) ====================

async function findActiveCombatByRun(runId) {
  const combat = await Combat.findOne({ run_id: runId, status: "ACTIVE" });
  if (!combat) {
    throw new Error("Kein aktiver Kampf für diesen Run gefunden");
  }
  return combat;
}

function removeCardFromHand(combat, cardId) {
  combat.hand = combat.hand.filter((id) => id.toString() !== cardId.toString());
}

function setEnemyHealth(combat, newHealth) {
  combat.enemy.current_health = Math.max(0, newHealth);
}

function setPlayerTurn(combat, isPlayerTurn) {
  combat.is_player_turn = isPlayerTurn;
}

function setCombatStatus(combat, status) {
  combat.status = status;
}

function setCombatHand(combat, newHand) {
  combat.hand = newHand;
}

// ==================== Öffentliche Service-Funktionen ====================

export async function startCombat(run, fieldPosition) {
  const map = await getMap();
  const field = map.fields.find((f) => f.position === fieldPosition);
  if (!field) {
    throw new Error("Ungültiges Feld: Feld existiert nicht auf der Map");
  }
  if (field.type !== "FIGHT" && field.type !== "BOSS") {
    throw new Error("Auf diesem Feld gibt es keinen Kampf");
  }
  if (!field.enemies || field.enemies.length === 0) {
    throw new Error("Diesem Feld ist kein Gegner zugeordnet");
  }

  const enemyData = field.enemies[0];
  const hand = await drawCards(run.id, HAND_SIZE);

  const combat = await Combat.create({
    run_id: run.id,
    field_position: fieldPosition,
    enemy: {
      name: enemyData.name,
      type: enemyData.type,
      max_health: enemyData.base_health,
      current_health: enemyData.base_health,
      base_damage: enemyData.base_damage,
    },
    hand,
    turn_start_hand_size: hand.length,
    is_player_turn: true,
    status: "ACTIVE",
  });

  return combat;
}

export async function answerCard(runId, userId, cardId, userAnswer) {
  const combat = await findActiveCombatByRun(runId);
  const run = await findRunById(runId);

  if (run.userId !== userId) {
    throw new Error("Nicht berechtigt, diesen Kampf zu spielen");
  }
  if (!combat.is_player_turn) {
    throw new Error("Der Gegner ist gerade am Zug");
  }
  const cardInHand = combat.hand.some(
    (id) => id.toString() === cardId.toString(),
  );
  if (!cardInHand) {
    throw new Error("Diese Karte ist nicht in deiner Hand");
  }

  const card = await IndexCardService.getIndexCard(cardId, userId);
  if (!card) {
    throw new Error("Karteikarte nicht gefunden");
  }

  const isCorrect =
    card.answer.toLowerCase().trim() === userAnswer.toLowerCase().trim();

  removeCardFromHand(combat, cardId);

  let damageDealt = 0;
  if (isCorrect) {
    const cardDamage = calculateCardDamage(card, run.studyGroupId);
    const multiplier = calculateDamageMultiplier(run.level);
    damageDealt = Math.round(cardDamage * multiplier);
    setEnemyHealth(combat, combat.enemy.current_health - damageDealt);
  }

  await discardCard(runId, cardId);
  await IndexCardService.recordAnswer(
    cardId,
    userId,
    run.studyGroupId,
    isCorrect,
  );

  const totalAnswers = run.totalAnswers + 1;
  const correctAnswers = run.correctAnswers + (isCorrect ? 1 : 0);

  // War die Runde perfekt? (Startgröße 5, jetzt leer, letzte Antwort richtig)
  const wasPerfectRound =
    combat.turn_start_hand_size === 5 && combat.hand.length === 0 && isCorrect;

  // Zug endet, wenn: falsch beantwortet, ODER Hand jetzt leer
  const turnEnds = !isCorrect || combat.hand.length === 0;

  let updatedRun = { ...run, totalAnswers, correctAnswers };

  if (wasPerfectRound) {
    heal(updatedRun, combat.enemy.base_damage);
  }

  // Gegner besiegt?
  if (combat.enemy.current_health <= 0) {
    setCombatStatus(combat, "WON");
    const remainingHand = [...combat.hand];
    setCombatHand(combat, []);

    levelUp(updatedRun);
    await applyLevelUp(runId, {
      level: updatedRun.level,
      maxHealth: updatedRun.maxHealth,
      currentHealth: updatedRun.currentHealth,
    });
    await updateHealthAndAnswers(runId, {
      currentHealth: updatedRun.currentHealth,
      correctAnswers,
      totalAnswers,
    });
    await returnCardsToDeck(runId, remainingHand);
    await combat.save();

    // war das ein Boss-Kampf? Dann ist der ganze Run gewonnen
    if (combat.enemy.type === "BOSS") {
      await endRunModel(runId, true, calculateDuration(run.startTime));
    }

    return {
      correct: isCorrect,
      damageDealt,
      correctAnswer: card.answer,
      combat,
      player: {
        level: updatedRun.level,
        maxHealth: updatedRun.maxHealth,
        currentHealth: updatedRun.currentHealth,
      },
    };
  }

  if (turnEnds) {
    setPlayerTurn(combat, false);
    takeDamage(updatedRun, combat.enemy.base_damage); // Gegner greift an

    if (updatedRun.currentHealth <= 0) {
      setCombatStatus(combat, "LOST");
      const remainingHand = [...combat.hand];
      setCombatHand(combat, []);

      await updateHealthAndAnswers(runId, {
        currentHealth: 0,
        correctAnswers,
        totalAnswers,
      });
      await returnCardsToDeck(runId, remainingHand); // Resthand zurück ins Deck
      await combat.save();
      await endRunModel(runId, false, calculateDuration(run.startTime)); //Run offiziell als gescheitert markieren

      return {
        correct: isCorrect,
        damageDealt,
        correctAnswer: card.answer,
        combat,
        player: {
          level: updatedRun.level,
          maxHealth: updatedRun.maxHealth,
          currentHealth: updatedRun.currentHealth,
        },
      };
    }

    const drawCount = wasPerfectRound ? 5 : 1;
    const newCards = await drawForNextTurn(
      runId,
      drawCount,
      combat.hand.length,
    );
    const updatedHand = wasPerfectRound
      ? newCards
      : [...combat.hand, ...newCards];
    setCombatHand(combat, updatedHand);
    combat.turn_start_hand_size = updatedHand.length;
    setPlayerTurn(combat, true);
  }

  await updateHealthAndAnswers(runId, {
    currentHealth: updatedRun.currentHealth,
    correctAnswers,
    totalAnswers,
  });
  await combat.save();

  return {
    correct: isCorrect,
    damageDealt,
    correctAnswer: card.answer,
    combat,
    player: {
      level: updatedRun.level,
      maxHealth: updatedRun.maxHealth,
      currentHealth: updatedRun.currentHealth,
    },
  };
}
