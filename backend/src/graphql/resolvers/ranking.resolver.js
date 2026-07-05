import { checkPermission } from '../../services/permission.service.js';
import * as RankingService from '../../services/ranking.service.js';
import { pubsub } from '../pubsub.js';
import { withFilter } from 'graphql-subscriptions';

// Von combat.service.js / run.service.js aufzurufen, sobald ein Run beendet wird
// (successful wird nicht mehr null) — löst ein Live-Update der Rangliste aus.
export const RANKING_UPDATED = 'RANKING_UPDATED';

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
  Subscription: {
    onRankingUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator([RANKING_UPDATED]),
        (payload, variables) => payload.studyGroupId === variables.studyGroupId,
      ),
      // Payload trägt nur die studyGroupId (leichtgewichtiger Trigger) — die eigentliche
      // Rangliste wird hier frisch berechnet, damit sie garantiert aktuell ist.
      resolve: async (payload) => {
        return await RankingService.getRanking(payload.studyGroupId);
      },
    },
  },
};