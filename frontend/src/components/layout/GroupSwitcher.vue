<template>
  <aside class="group-switcher">
    <button class="icon-btn" title="Suche">🔍</button>
    <div class="group-list">
      <button
        v-for="group in groups"
        :key="group.id"
        class="group-btn"
        :class="{ active: selectedGroupId === group.id }"
        @click="$emit('select', group)"
        :title="group.name"
      >
        {{ group.name.slice(0, 2).toUpperCase() }}
      </button>
      <button class="group-btn add-btn" title="Gruppe erstellen" @click="$emit('create')">+</button>
    </div>
  </aside>
</template>

<script setup>
defineProps({
  groups: Array,
  selectedGroupId: String,
});
defineEmits(['select', 'create']);
</script>