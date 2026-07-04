import * as MapService from "../../services/map.service.js";
import * as RunService from "../../services/run.service.js";
import * as CombatService from "../../services/combat.service.js";
import * as IndexCardService from "../../services/indexCard.service.js";
import * as RunDeckService from "../../services/runDeck.service.js";
import { mapCard } from "./indexCard.resolver.js";

function mapField(field) {
  return {
    id: field._id.toString(),
    position: field.position,
    x: field.x,
    y: field.y,
    type: field.type,
    nextFields: field.nextFields || [],
    enemies: (field.enemies || []).map((e) => ({
      id: e._id.toString(),
      name: e.name,
      type: e.type,
      baseHealth: e.base_health,
      baseDamage: e.base_damage,
    })),
  };
}

export const runResolvers = {
  Query: {
    getMap: async (_, __, context) => {
      if (!context.user) {
        throw new Error("Nicht authentifiziert");
      }
      const map = await MapService.getMap();
      if (!map) {
        throw new Error("Map nicht gefunden");
      }
      return {
        id: map._id.toString(),
        name: map.name,
        fields: map.fields.map(mapField),
      };
    },
  },
  Mutation: {
    startRun: async (
      _,
      { studyGroupId, selectedStartFieldPosition },
      context,
    ) => {
      if (!context.user) {
        throw new Error("Nicht authentifiziert");
      }
      return await RunService.startRun(
        context.user.id,
        studyGroupId,
        selectedStartFieldPosition,
      );
    },

    endRun: async (_, { runId, successful }, context) => {
      if (!context.user) {
        throw new Error("Nicht authentifiziert");
      }
      return await RunService.endRun(runId, context.user.id, successful);
    },
    moveToField: async (_, { runId, targetPosition }, context) => {
      if (!context.user) {
        throw new Error("Nicht authentifiziert");
      }
      return await RunService.moveToField(
        runId,
        context.user.id,
        targetPosition,
      );
    },

    answerCard: async (_, { runId, cardId, userAnswer }, context) => {
      if (!context.user) {
        throw new Error("Nicht authentifiziert");
      }
      return await CombatService.answerCard(
        runId,
        context.user.id,
        cardId,
        userAnswer,
      );
    },
  },
  Combat: {
    id: (combat) => combat._id.toString(),
    isPlayerTurn: (combat) => combat.is_player_turn,
    status: (combat) => combat.status,
    hand: async (combat) => {
      const cards = await IndexCardService.getIndexCardsByIds(combat.hand);
      return cards.map(mapCard);
    },
    enemy: (combat) => ({
      name: combat.enemy.name,
      type: combat.enemy.type,
      maxHealth: combat.enemy.max_health,
      currentHealth: combat.enemy.current_health,
      baseDamage: combat.enemy.base_damage,
    }),
  },
  Run: {
    player: (run) => ({
      level: run.level,
      maxHealth: run.maxHealth,
      currentHealth: run.currentHealth,
    }),
    deck: async (run) => {
      const runDeck = await RunDeckService.findRunDeck(run.id);
      if (!runDeck) return [];
      const cards = await IndexCardService.getIndexCardsByIds(runDeck.deck);
      return cards.map(mapCard);
    },
    discardPile: async (run) => {
      const runDeck = await RunDeckService.findRunDeck(run.id);
      if (!runDeck) return [];
      const cards = await IndexCardService.getIndexCardsByIds(
        runDeck.discard_pile,
      );
      return cards.map(mapCard);
    },
  },
};
