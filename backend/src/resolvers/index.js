export const resolvers = {
  Query: {
    getStudyGroup: () => null,
    getIndexCards: () => [],
  },
  Mutation: {
    createStudyGroup: () => null,
    joinStudyGroup: () => null,
    leaveStudyGroup: () => null,
    createIndexCard: () => null,
    updateIndexCard: () => null,
    deleteIndexCard: () => null,
    startRun: () => null,
    endRun: () => null,
    answerCard: () => null,
    sendMessage: () => null,
  },
  Subscription: {},
};
