import * as IndexCardService from '../../services/indexCard.service.js';

export const indexCardResolvers = {
  Query: {
    getIndexCards: (_, { studyGroupId, tags, search, creatorId }, context) => {
      if (!context.user) throw new Error('Nicht authentifiziert');
      // TODO: ersetzen wenn indexCard.service.js fertig
      return [];
    },
    getIndexCard: (_, { id }, context) => {
      if (!context.user) throw new Error('Nicht authentifiziert');
      // TODO: ersetzen wenn indexCard.service.js fertig
      return null;
    },
  },
  Mutation: {
    createIndexCard: (_, { studyGroupId, question, answer, tags }, context) => {
      if (!context.user) throw new Error('Nicht authentifiziert');
      // TODO: ersetzen wenn indexCard.service.js fertig
      return null;
    },
    updateIndexCard: (_, { id, question, answer, tags }, context) => {
      if (!context.user) throw new Error('Nicht authentifiziert');
      // TODO: ersetzen wenn indexCard.service.js fertig
      return null;
    },
    deleteIndexCard: (_, { id }, context) => {
      if (!context.user) throw new Error('Nicht authentifiziert');
      // TODO: ersetzen wenn indexCard.service.js fertig
      return false;
    },
  },
  IndexCard: {
    creator: (parent) => {
      // TODO: ersetzen wenn indexCard.service.js fertig
      return null;
    },
  },
};