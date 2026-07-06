<template>
  <div class="members-list">
      <div v-for="group in groupedMembers" :key="group.role" class="role-group">
        <h4 class="role-heading" :data-role="group.role">{{ group.heading }}</h4>
        <div v-for="member in group.members" :key="member.user.id" class="member">
        <div class="member-avatar">{{ member.user?.name?.slice(0, 1) }}</div>
        <span class="member-name">{{ member.user?.name }}</span>

        <div class="member-actions" v-if="canManage(member)">
          <button
            v-if="currentUserRole === 'ADMIN' && member.role === 'MEMBER'"
            class="icon-btn"
            title="Zum Moderator machen"
            @click="promote(member)"
          >
            🛡️
          </button>
          <button
            v-if="currentUserRole === 'ADMIN' && member.role === 'MODERATOR'"
            class="icon-btn"
            title="Moderator-Rolle entfernen"
            @click="demote(member)"
          >
            ⬇️
          </button>
          <button
            class="icon-btn"
            title="Aus der Gruppe entfernen"
            @click="kick(member)"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
    <p v-if="error" class="error-msg">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useMutation } from '@vue/apollo-composable';
import { gql } from '@apollo/client/core';

const props = defineProps({
  members: Array,
  currentUserRole: String,
  studyGroupId: String,
});
const emit = defineEmits(['membersChanged']);

const error = ref('');

const groupedMembers = computed(() =>
  [
    { role: 'ADMIN', heading: 'Admin', members: props.members.filter((m) => m.role === 'ADMIN') },
    { role: 'MODERATOR', heading: 'Moderatoren', members: props.members.filter((m) => m.role === 'MODERATOR') },
    { role: 'MEMBER', heading: 'Mitglieder', members: props.members.filter((m) => m.role === 'MEMBER') },
  ].filter((group) => group.members.length > 0),
);

const UPDATE_MEMBERSHIP_ROLE = gql`
  mutation UpdateMembershipRole($studyGroupId: ID!, $userId: ID!, $role: Role!) {
    updateMembershipRole(studyGroupId: $studyGroupId, userId: $userId, role: $role) {
      role
      user { id name }
    }
  }
`;

const REMOVE_MEMBER = gql`
  mutation RemoveMember($studyGroupId: ID!, $userId: ID!) {
    removeMember(studyGroupId: $studyGroupId, userId: $userId)
  }
`;

const { mutate: updateRole } = useMutation(UPDATE_MEMBERSHIP_ROLE);
const { mutate: removeMemberMutation } = useMutation(REMOVE_MEMBER);

function canManage(member) {
  if (!props.currentUserRole) return false;
  if (props.currentUserRole === 'ADMIN') return member.role !== 'ADMIN';
  if (props.currentUserRole === 'MODERATOR') return member.role === 'MEMBER';
  return false;
}

async function promote(member) {
  await runAction(() =>
    updateRole({ studyGroupId: props.studyGroupId, userId: member.user.id, role: 'MODERATOR' }),
  );
}

async function demote(member) {
  await runAction(() =>
    updateRole({ studyGroupId: props.studyGroupId, userId: member.user.id, role: 'MEMBER' }),
  );
}

async function kick(member) {
  await runAction(() =>
    removeMemberMutation({ studyGroupId: props.studyGroupId, userId: member.user.id }),
  );
}

async function runAction(fn) {
  error.value = '';
  try {
    await fn();
    emit('membersChanged');
  } catch (err) {
    error.value = err.message || 'Aktion fehlgeschlagen';
  }
}
</script>