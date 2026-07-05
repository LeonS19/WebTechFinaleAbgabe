import * as IndexCardService from "../../services/indexCard.service.js";
import * as UserModel from "../../models/sql/user.model.js";
import { pubsub } from "../pubsub.js";
import { withFilter } from "graphql-subscriptions";

export function mapCard(card) {
  if (!card) return null;
  const obj = card.toObject ? card.toObject() : card;
  return {
    id: obj._id.toString(),
    studyGroupId: obj.study_group_id,
    creatorId: obj.creator_id,
    question: obj.question,
    answer: obj.answer,
    tags: obj.tags || [],
    attachments: (obj.attachments || []).map((a) => ({
      id: a._id.toString(),
      filename: a.filename,
      mimeType: a.mime_type,
      sizeInBytes: a.size_in_bytes,
      uploadedAt: a.uploaded_at?.toString(),
      uploadedBy: a.uploaded_by,
    })),
    groupStats: (obj.group_stats || []).map((s) => ({
      studyGroupId: s.study_group_id,
      totalAttempts: s.total_attempts,
      correctAnswers: s.correct_answers,
      difficulty:
        s.total_attempts > 0 ? s.correct_answers / s.total_attempts : 0,
    })),
    userStats: (obj.user_stats || []).map((s) => ({
      userId: s.user_id,
      totalAttempts: s.total_attempts,
      correctAnswers: s.correct_answers,
      lastSeenAt: s.last_seen_at?.toString(),
    })),
    createdAt: obj.created_at?.toString(),
    updatedAt: obj.updated_at?.toString(),
  };
}

const INDEX_CARD_CREATED = "INDEX_CARD_CREATED";
const INDEX_CARD_UPDATED = "INDEX_CARD_UPDATED";
const INDEX_CARD_DELETED = "INDEX_CARD_DELETED";

export const indexCardResolvers = {
  Query: {
    getIndexCards: async (
      _,
      { studyGroupId, tags, search, creatorId },
      context,
    ) => {
      if (!context.user) throw new Error("Nicht authentifiziert");
      const cards = await IndexCardService.getIndexCards(
        studyGroupId,
        tags,
        search,
        creatorId,
        context.user.id,
      );
      return cards.map(mapCard);
    },
    getIndexCard: async (_, { id }, context) => {
      if (!context.user) throw new Error("Nicht authentifiziert");
      const card = await IndexCardService.getIndexCard(id, context.user.id);
      return mapCard(card);
    },
  },
  Mutation: {
    createIndexCard: async (
      _,
      { studyGroupId, question, answer, tags },
      context,
    ) => {
      if (!context.user) throw new Error("Nicht authentifiziert");
      const card = await IndexCardService.createIndexCard(
        {
          study_group_id: studyGroupId,
          question,
          answer,
          tags: tags || [],
        },
        context.user.id,
      );

      const mapped = mapCard(card); // ← erst mappen

      pubsub.publish(INDEX_CARD_CREATED, {
        // ← dann publishen
        onIndexCardCreated: mapped,
        studyGroupId,
      });

      return mapped; // ← dann returnen
    },
    updateIndexCard: async (_, { id, question, answer, tags }, context) => {
      if (!context.user) throw new Error("Nicht authentifiziert");
      const data = {};
      if (question !== undefined) data.question = question;
      if (answer !== undefined) data.answer = answer;
      if (tags !== undefined) data.tags = tags;
      const card = await IndexCardService.updateIndexCard(
        id,
        data,
        context.user.id,
      );

      const mapped = mapCard(card); // ← erst mappen

      pubsub.publish(INDEX_CARD_UPDATED, {
        onIndexCardUpdated: mapped,
        studyGroupId: mapped.studyGroupId,
      });

      return mapped; // ← dann returnen
    },
    deleteIndexCard: async (_, { id }, context) => {
      if (!context.user) throw new Error("Nicht authentifiziert");
      const { studyGroupId } = await IndexCardService.deleteIndexCard(
        id,
        context.user.id,
      );

      pubsub.publish(INDEX_CARD_DELETED, {
        onIndexCardDeleted: id,
        studyGroupId,
      });

      return true;
    },
  },
  IndexCard: {
    creator: (parent) => UserModel.findById(parent.creatorId),
  },
  Subscription: {
    onIndexCardCreated: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator([INDEX_CARD_CREATED]),
        (payload, variables) => payload.studyGroupId === variables.studyGroupId,
      ),
      resolve: (payload) => payload.onIndexCardCreated,
    },
    onIndexCardUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator([INDEX_CARD_UPDATED]),
        (payload, variables) => payload.studyGroupId === variables.studyGroupId,
      ),
      resolve: (payload) => payload.onIndexCardUpdated,
    },
    onIndexCardDeleted: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator([INDEX_CARD_DELETED]),
        (payload, variables) => payload.studyGroupId === variables.studyGroupId,
      ),
      resolve: (payload) => payload.onIndexCardDeleted,
    },
  },
};
