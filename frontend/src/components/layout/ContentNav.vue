<template>
  <nav class="content-nav" v-if="visible">
    <button
      :class="{ active: activeView === 'karteikarten' }"
      @click="$emit('change', 'karteikarten')"
    >Karteikarten</button>
    <button
      :class="{ active: activeView === 'bestenliste' }"
      @click="$emit('change', 'bestenliste')"
    >Bestenliste</button>
    <button
      :class="{ active: activeView === 'historie' }"
      @click="$emit('change', 'historie')"
    >Run Historie</button>
    <div class="nav-bottom">
      <button class="run-btn" @click="$emit('startRun')">Run Starten</button>
    </div>
  </nav>
</template>

<script setup>
defineProps({
  activeView: String,
  visible: Boolean,
});
defineEmits(['change', 'startRun']);
</script>