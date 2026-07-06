<template>
  <aside class="members-sidebar" v-if="visible">
    <MembersList
      :members="members"
      :currentUserRole="currentUserRole"
      :studyGroupId="studyGroupId"
      @membersChanged="$emit('membersChanged')"
    />
    <div class="sidebar-bottom">
      <button class="chat-btn" @click="$emit('openChat')">Chat öffnen</button>
    </div>
  </aside>
</template>

<script setup>
import MembersList from '../members/MembersList.vue';

defineProps({
  members: Array,
  visible: Boolean,
  currentUserRole: String,
  studyGroupId: String,
});
defineEmits(['openChat', 'membersChanged']);
</script>