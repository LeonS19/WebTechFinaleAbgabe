import * as StudyGroupModel from "../models/sql/studyGroup.model.js";
import * as MembershipModel from "../models/sql/membership.model.js";
import crypto from "crypto";

export async function getStudyGroup(id) {
  return StudyGroupModel.findById(id);
}

export async function createStudyGroup(name, creatorUserId) {
  const chatId = crypto.randomUUID(); // referenziert später ein MongoDB Chat-Dokument
  const studyGroup = await StudyGroupModel.create(name, chatId);

  // Ersteller wird automatisch ADMIN
  await MembershipModel.create(creatorUserId, studyGroup.id, "ADMIN");

  return studyGroup;
}

export async function joinStudyGroup(studyGroupId, userId) {
  const existing = await MembershipModel.findOne(userId, studyGroupId);
  if (existing) {
    throw new Error('User ist bereits Mitglied dieser Gruppe');
  }
  return MembershipModel.create(userId, studyGroupId, 'MEMBER');
}

export async function leaveStudyGroup(studyGroupId, userId) {
  return MembershipModel.remove(userId, studyGroupId);
}

export async function getMembers(studyGroupId) {
  return MembershipModel.findByStudyGroup(studyGroupId);
}