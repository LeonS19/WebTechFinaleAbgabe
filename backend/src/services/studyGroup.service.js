import * as StudyGroupModel from "../models/sql/studyGroup.model.js";
import * as MembershipModel from "../models/sql/membership.model.js";
import crypto from "crypto";

export async function getStudyGroup(id) {
  return StudyGroupModel.findById(id);
}

export async function getStudyGroups(search) {
  return StudyGroupModel.findAll(search);
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
  const membership = await MembershipModel.findOne(userId, studyGroupId);

  if (!membership) {
    throw new Error('Du bist kein Mitglied dieser Gruppe');
  }

  if (membership.role === 'ADMIN') {
    const members = await MembershipModel.findByStudyGroup(studyGroupId);
    const otherMembers = members.filter(m => m.userId !== userId);

    if (otherMembers.length === 0) {
      // Admin ist der letzte User → Gruppe löschen
      await MembershipModel.remove(userId, studyGroupId);
      return StudyGroupModel.deleteById(studyGroupId);
    }

    // Erst Moderatoren, dann alle anderen, sortiert nach joinedAt
    const moderators = otherMembers.filter(m => m.role === 'MODERATOR');
    const candidates = moderators.length > 0 ? moderators : otherMembers;
    candidates.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
    const nextAdmin = candidates[0];

    await MembershipModel.updateRole(nextAdmin.userId, studyGroupId, 'ADMIN');
  }

  return MembershipModel.remove(userId, studyGroupId);
}

export async function getMembers(studyGroupId) {
  return MembershipModel.findByStudyGroup(studyGroupId);
}

export async function removeMember(studyGroupId, targetUserId, requestingUserId) {
  // Rechte-Check: nur ADMIN darf andere Mitglieder entfernen
  const requestingMembership = await MembershipModel.findOne(requestingUserId, studyGroupId);

  if (!requestingMembership) {
    throw new Error('Du bist kein Mitglied dieser Gruppe');
  }
  if (requestingMembership.role !== 'ADMIN') {
    throw new Error('Nur Admins dürfen Mitglieder entfernen');
  }
  if (targetUserId === requestingUserId) {
    throw new Error('Du kannst dich nicht selbst über removeMember entfernen, nutze leaveStudyGroup');
  }

  return MembershipModel.remove(targetUserId, studyGroupId);
}