<template>
  <header class="dashboard-header">
    <span class="group-name">{{ groupName || 'Keine Gruppe ausgewählt' }}</span>
    <div class="user-area">
      <button class="user-btn" @click="$emit('toggleMenu')">
        <div class="avatar">{{ initial }}</div>
      </button>
      <div v-if="menuOpen" class="user-menu">
        <p class="user-menu-name">{{ user?.name }}</p>
        <p class="user-menu-role">{{ role || '–' }}</p>
        <hr />
        <button v-if="hasGroup" @click="$emit('leaveGroup')">Gruppe verlassen</button>
        <hr />
        <button class="logout-btn" @click="$emit('logout')">Ausloggen</button>
      </div>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  groupName: String,
  user: Object,
  role: String,
  menuOpen: Boolean,
  hasGroup: Boolean,
});

defineEmits(['toggleMenu', 'leaveGroup', 'logout']);

const initial = computed(() => props.user?.name?.slice(0, 1) || '?');
</script>