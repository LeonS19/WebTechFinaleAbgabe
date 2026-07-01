<template>
  <div class="members-list">
    <div v-for="member in members" :key="member.userId" class="member">
      <div class="member-avatar">{{ member.user?.name?.slice(0, 1) }}</div>
      <span>{{ member.user?.name }}</span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  members: Array,
});
</script>