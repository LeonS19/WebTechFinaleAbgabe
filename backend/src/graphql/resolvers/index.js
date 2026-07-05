import { studyGroupResolvers } from "./studyGroup.resolver.js";
import { indexCardResolvers } from './indexCard.resolver.js';
import { chatResolvers } from './chat.resolver.js';
import { runResolvers } from './run.resolver.js';

export const resolvers = {
  Query: {
    ...studyGroupResolvers.Query,
    ...indexCardResolvers.Query,
    ...chatResolvers.Query,
    ...runResolvers.Query,
    getRanking: () => [],
    getRuns: () => [],
  },
  Mutation: {
    ...studyGroupResolvers.Mutation,
    ...indexCardResolvers.Mutation,
    ...runResolvers.Mutation,
    ...chatResolvers.Mutation,
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
  Message: {
    ...chatResolvers.Message,
  },
  Combat: {
    ...runResolvers.Combat,
  },
  Run: {
  ...runResolvers.Run,
  },
  Subscription: {
    ...indexCardResolvers.Subscription,
    ...runResolvers.Subscription,
  },
};