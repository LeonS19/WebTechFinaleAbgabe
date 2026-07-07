import { checkPermission } from "./permission.service.js";
import { buildRunDeck } from "./deckBuilder.service.js";
import { createRunDeck } from "./runDeck.service.js";
import * as IndexCardService from "./indexCard.service.js";
import { getMap } from "./map.service.js";
import { startCombat } from "./combat.service.js";
import { heal } from "./utils/playerStats.util.js";
import {
  createRun,
  findActiveRunByUser,
  findRunById,
  findRunsByUser,
  updatePosition,
  updateHealthAndAnswers,
  endRun as endRunModel,
} from "../models/sql/run.model.js";
import { pubsub } from '../graphql/pubsub.js';
import { RANKING_UPDATED } from '../graphql/resolvers/ranking.resolver.js';

const MIN_CARD_AMOUNT = 5;
const HEAL_FIELD_PERCENTAGE = 0.5;

export async function startRun(
  userId,
  studyGroupId,
  selectedStartFieldPosition,
) {
  await checkPermission(userId, studyGroupId, ["ADMIN", "MODERATOR", "MEMBER"]);

  const existingRun = await findActiveRunByUser(userId, studyGroupId);
  if (existingRun) {
    return existingRun;
  }

  const availableCards = await IndexCardService.getIndexCards(
    studyGroupId,
    undefined,
    undefined,
    undefined,
    userId,
  );
  if (availableCards.length < MIN_CARD_AMOUNT) {
    throw new Error(
      `Die Lerngruppe braucht mindestens ${MIN_CARD_AMOUNT} Karteikarten, um einen Run zu starten`,
    );
  }

  // Startfeld validieren — ist startFieldPosition wirklich ein START-Feld auf der Map?
  //   NUR GETMAP, DA ES NUR EINE MAP GIBT (Map aus MongoDB laden, field.type === 'START' prüfen)
  const map = await getMap();
  if (!map) {
    throw new Error("Es konnte keine Map gefunden werden");
  }

  const field = map.fields.find(
    (f) => f.position === selectedStartFieldPosition,
  );
  if (!field) {
    throw new Error("Ungültiges Feld: Feld existiert nicht auf der Map");
  }
  if (field.type !== "START") {
    throw new Error("Ungültiges Startfeld: Position ist kein Startfeld");
  }

  const run = await createRun(
    userId,
    studyGroupId,
    map.id,
    selectedStartFieldPosition,
  );

  const deckCardIds = await buildRunDeck(availableCards, userId);
  await createRunDeck(run.id, deckCardIds);

  return run;
}

export async function moveToField(runId, userId, targetPosition) {
  const run = await findRunById(runId);
  if (!run) {
    throw new Error("Run nicht gefunden");
  }
  if (run.userId !== userId) {
    throw new Error("Nicht berechtigt, diesen Run zu spielen");
  }
  if (run.successful !== null) {
    throw new Error("Run ist bereits beendet");
  }

  const map = await getMap();
  const currentField = map.fields.find(
    (f) => f.position === run.currentPosition,
  );
  if (!currentField.nextFields.includes(targetPosition)) {
    throw new Error("Zielfeld ist von hier aus nicht erreichbar");
  }

  const updatedRun = await updatePosition(runId, targetPosition);

  const targetField = map.fields.find((f) => f.position === targetPosition);

  if (targetField.type === "FIGHT" || targetField.type === "BOSS") {
    const combat = await startCombat(updatedRun, targetPosition);
    return { run: updatedRun, combat };
  }

  if (targetField.type === "HEAL") {
    const healAmount = Math.round(updatedRun.maxHealth * HEAL_FIELD_PERCENTAGE);
    heal(updatedRun, healAmount);
    await updateHealthAndAnswers(runId, {
      currentHealth: updatedRun.currentHealth,
      correctAnswers: updatedRun.correctAnswers,
      totalAnswers: updatedRun.totalAnswers,
    });
    return { run: updatedRun, combat: null };
  }

  return { run: updatedRun, combat: null };
}

export async function getActiveRun(userId, studyGroupId) {
  return await findActiveRunByUser(userId, studyGroupId); // gibt null zurück, falls keiner existiert
}

// Alle Runs des Users (Historie) — Filterung nach Lerngruppe passiert im Frontend
// über run.studyGroup.id, kein Permission-Check nötig (eigene Daten)
export async function getRunHistory(userId) {
  return await findRunsByUser(userId);
}

export async function endRun(runId, userId, successful) {
  const run = await findRunById(runId);

  if (!run) {
    throw new Error("Run nicht gefunden");
  }
  if (run.userId !== userId) {
    throw new Error("Nicht berechtigt, diesen Run zu beenden");
  }
  if (run.successful !== null) {
    throw new Error("Run wurde bereits beendet");
  }

  const durationInSeconds = Math.round(
    (Date.now() - new Date(run.startTime).getTime()) / 1000,
  );

  const endedRun = await endRunModel(runId, successful, durationInSeconds); // abgeändert damit man noch den Run publishen kann
  pubsub.publish(RANKING_UPDATED, { studyGroupId: run.studyGroupId }); 
  return endedRun;
}