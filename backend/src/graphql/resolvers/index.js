import { studyGroupResolvers } from "./studyGroup.resolver.js";

export const resolvers = {
  Query: {
    ...studyGroupResolvers.Query,
    getIndexCards: () => [],
    getIndexCard: () => null,
    getRanking: () => [],
    getRuns: () => [],
    getMap: () => null,
  },
  Mutation: {
    ...studyGroupResolvers.Mutation,
    createIndexCard: () => null,
    updateIndexCard: () => null,
    deleteIndexCard: () => null,
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
