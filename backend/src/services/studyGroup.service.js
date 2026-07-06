import * as StudyGroupModel from "../models/sql/studyGroup.model.js";
import * as MembershipModel from "../models/sql/membership.model.js";
import { checkPermission } from './permission.service.js';
import crypto from "crypto";
import { pubsub } from '../graphql/pubsub.js';
import { MEMBERS_UPDATED } from '../graphql/resolvers/studyGroup.resolver.js';

export async function getStudyGroup(id) {
  return StudyGroupModel.findById(id);
}

export async function getStudyGroups(search) {
  return StudyGroupModel.findAll(search);
}

export async function getMyStudyGroups(userId) {
  const memberships = await MembershipModel.findByUser(userId);
  const groups = await Promise.all(
    memberships.map(m => StudyGroupModel.findById(m.studyGroupId))
  );
  return groups.filter(Boolean);
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
  const result = await MembershipModel.create(userId, studyGroupId, 'MEMBER');
  pubsub.publish(MEMBERS_UPDATED, { studyGroupId });   // NEU
  return result;
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
      await MembershipModel.remove(userId, studyGroupId);
      return StudyGroupModel.deleteById(studyGroupId);
    }

    const moderators = otherMembers.filter(m => m.role === 'MODERATOR');
    const candidates = moderators.length > 0 ? moderators : otherMembers;
    candidates.sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt));
    const nextAdmin = candidates[0];

    await MembershipModel.updateRole(nextAdmin.userId, studyGroupId, 'ADMIN');
  }

  const result = await MembershipModel.remove(userId, studyGroupId);
  pubsub.publish(MEMBERS_UPDATED, { studyGroupId });   // NEU
  return result;
}

export async function getMembers(studyGroupId) {
  return MembershipModel.findByStudyGroup(studyGroupId);
}

export async function removeMember(studyGroupId, targetUserId, requestingUserId) {
  const requestingMembership = await checkPermission(requestingUserId, studyGroupId, ['ADMIN', 'MODERATOR']);

  if (targetUserId === requestingUserId) {
    throw new Error('Du kannst dich nicht selbst über removeMember entfernen, nutze leaveStudyGroup');
  }

  const targetMembership = await MembershipModel.findOne(targetUserId, studyGroupId);
  if (!targetMembership) {
    throw new Error('Dieser User ist kein Mitglied der Gruppe');
  }

  if (requestingMembership.role === 'MODERATOR' && targetMembership.role !== 'MEMBER') {
    throw new Error('Als Moderator darfst du nur einfache Mitglieder entfernen');
  }

  const result = await MembershipModel.remove(targetUserId, studyGroupId);
  pubsub.publish(MEMBERS_UPDATED, { studyGroupId });   // NEU
  return result;
}

export async function updateMembershipRole(studyGroupId, targetUserId, newRole, requestingUserId) {
  await checkPermission(requestingUserId, studyGroupId, ['ADMIN']);

  if (targetUserId === requestingUserId) {
    throw new Error('Du kannst deine eigene Rolle nicht ändern');
  }
  if (newRole !== 'MODERATOR' && newRole !== 'MEMBER') {
    throw new Error('Rolle kann nur zwischen MODERATOR und MEMBER geändert werden');
  }

  const targetMembership = await MembershipModel.findOne(targetUserId, studyGroupId);
  if (!targetMembership) {
    throw new Error('Dieser User ist kein Mitglied der Gruppe');
  }
  if (targetMembership.role === 'ADMIN') {
    throw new Error('Die Rolle des Admins kann nicht über diese Funktion geändert werden');
  }

  const result = await MembershipModel.updateRole(targetUserId, studyGroupId, newRole);
  pubsub.publish(MEMBERS_UPDATED, { studyGroupId });   // NEU
  return result;
}