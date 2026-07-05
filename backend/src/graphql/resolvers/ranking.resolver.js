import { checkPermission } from '../../services/permission.service.js';
import * as RankingService from '../../services/ranking.service.js';

export const rankingResolvers = {
  Query: {
    getRanking: async (_, { studyGroupId }, context) => {
      if (!context.user) {
        throw new Error('Nicht authentifiziert');
      }
      // Nur Mitglieder der Lerngruppe dürfen deren Rangliste sehen
      await checkPermission(context.user.id, studyGroupId, ['ADMIN', 'MODERATOR', 'MEMBER']);

      return await RankingService.getRanking(studyGroupId);
    },
  },
};