import * as StudyGroupService from "../../services/studyGroup.service.js";
import * as UserModel from "../../models/sql/user.model.js";

export const studyGroupResolvers = {
  Query: {
    getStudyGroup: (_, { id }) => StudyGroupService.getStudyGroup(id),
    getStudyGroups: async (_, { search }, context) => {
      if (!context.user) throw new Error("Nicht authentifiziert");
      return StudyGroupService.getStudyGroups(search);
    },
    getMyStudyGroups: async (_, __, context) => {
      if (!context.user) throw new Error("Nicht authentifiziert");
      return StudyGroupService.getMyStudyGroups(context.user.id);
    },
    me: async (_, __, context) => {
      if (!context.user) throw new Error("Nicht authentifiziert");
      const user = await UserModel.findById(context.user.id);
      if (!user) throw new Error("Nutzer nicht gefunden");
      return user;
    },
  },
  Mutation: {
    createStudyGroup: (_, { name }, context) => {
      if (!context.user) throw new Error("Nicht authentifiziert");
      return StudyGroupService.createStudyGroup(name, context.user.id);
    },
    joinStudyGroup: (_, { studyGroupId }, context) => {
      if (!context.user) throw new Error("Nicht authentifiziert");
      return StudyGroupService.joinStudyGroup(studyGroupId, context.user.id);
    },
    leaveStudyGroup: (_, { studyGroupId }, context) => {
      if (!context.user) throw new Error("Nicht authentifiziert");
      return StudyGroupService.leaveStudyGroup(studyGroupId, context.user.id);
    },
    removeMember: (_, { studyGroupId, userId }, context) => {
      if (!context.user) throw new Error("Nicht authentifiziert");
      return StudyGroupService.removeMember(
        studyGroupId,
        userId,
        context.user.id,
      );
    },
    updateMembershipRole: async (_, { studyGroupId, userId, role }, context) => {
      if (!context.user) {
        throw new Error('Nicht authentifiziert');
      }
      return await StudyGroupService.updateMembershipRole(studyGroupId, userId, role, context.user.id);
    },
  },
  StudyGroup: {
    members: (parent) => StudyGroupService.getMembers(parent.id),
  },
  Membership: {
    user: (parent) => UserModel.findById(parent.userId),
    studyGroup: (parent) =>
      StudyGroupService.getStudyGroup(parent.studyGroupId),
  },
};
