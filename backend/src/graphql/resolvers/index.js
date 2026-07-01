import { studyGroupResolvers } from "./studyGroup.resolver.js";
import { indexCardResolvers } from './indexCard.resolver.js';

export const resolvers = {
  Query: {
    ...studyGroupResolvers.Query,
    ...indexCardResolvers.Query,
    getRanking: () => [],
    getRuns: () => [],
    getMap: () => null,
  },
  Mutation: {
    ...studyGroupResolvers.Mutation,
    ...indexCardResolvers.Mutation,
    startRun: () => null,
    endRun: () => null,
    answerCard: () => null,
    sendMessage: () => null,
  },
  StudyGroup: {
    ...studyGroupResolvers.StudyGroup,
  },
  Membership: {
    ...studyGroupResolvers.Membership,
  },
  IndexCard: {
    ...indexCardResolvers.IndexCard,
  },
  Subscription: {},
};
