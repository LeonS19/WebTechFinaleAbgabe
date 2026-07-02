import * as IndexCardService from "../../services/indexCard.service.js";
import * as UserModel from "../../models/sql/user.model.js";

function mapCard(card) {
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
      return mapCard(card);
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
      return mapCard(card);
    },
    deleteIndexCard: async (_, { id }, context) => {
      if (!context.user) throw new Error("Nicht authentifiziert");
      await IndexCardService.deleteIndexCard(id, context.user.id);
      return true;
    },
  },
  IndexCard: {
    creator: (parent) => UserModel.findById(parent.creatorId),
  },
};
