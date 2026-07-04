<template>
  <!-- Normaler Modus -->
  <nav class="content-nav" v-if="visible && activeView !== 'run'">
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
      <button class="run-btn" title="Starte deinen Run oder führe ihn fort" @click="$emit('startRun')">
        Run
      </button>
    </div>
  </nav>

  <!-- Run Modus -->
  <div class="run-nav" v-if="visible && activeView === 'run'">
    <button class="run-nav-toggle" @click="runNavOpen = !runNavOpen">
      {{ runNavOpen ? '‹' : '›' }}
    </button>
    <div class="run-nav-panel" v-if="runNavOpen">
      <button @click="$emit('change', 'karteikarten'); runNavOpen = false">Karteikarten</button>
      <button @click="$emit('change', 'bestenliste'); runNavOpen = false">Bestenliste</button>
      <button @click="$emit('change', 'historie'); runNavOpen = false">Run Historie</button>
      <div class="nav-bottom">
        <button class="run-btn" @click="$emit('startRun'); runNavOpen = false">Zum Run</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

defineProps({
  activeView: String,
  visible: Boolean,
});
defineEmits(['change', 'startRun']);

const runNavOpen = ref(false);
</script>