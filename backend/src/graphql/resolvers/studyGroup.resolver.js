import * as StudyGroupService from '../../services/studyGroup.service.js';
import * as UserModel from '../../models/sql/user.model.js';

export const studyGroupResolvers = {
  Query: {
    getStudyGroup: (_, { id }) => StudyGroupService.getStudyGroup(id),
  },
  Mutation: {
    createStudyGroup: (_, { name }, context) => {
      if (!context.user) throw new Error('Nicht authentifiziert');
      return StudyGroupService.createStudyGroup(name, context.user.id);
    },
    joinStudyGroup: (_, { studyGroupId }, context) => {
      if (!context.user) throw new Error('Nicht authentifiziert');
      return StudyGroupService.joinStudyGroup(studyGroupId, context.user.id);
    },
    leaveStudyGroup: (_, { studyGroupId }, context) => {
      if (!context.user) throw new Error('Nicht authentifiziert');
      return StudyGroupService.leaveStudyGroup(studyGroupId, context.user.id);
    },
  },
  StudyGroup: {
    members: (parent) => StudyGroupService.getMembers(parent.id),
  },
  Membership: {
    user: (parent) => UserModel.findById(parent.userId),
    studyGroup: (parent) => StudyGroupService.getStudyGroup(parent.studyGroupId),
  },
};
