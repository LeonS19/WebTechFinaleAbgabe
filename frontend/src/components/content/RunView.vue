<template>
  <div class="run-view">

    <!-- Map Phase -->
    <RunMapView
      v-if="phase !== 'combat'"
      :fields="mapFields"
      :currentPosition="currentPosition"
      :phase="mapPhase"
      @fieldSelected="onFieldSelected"
    />

    <!-- Kampf Placeholder -->
    <div v-if="phase === 'combat'" class="combat-placeholder">
      <h2>⚔️ Kampf!</h2>
      <p>Gegner: <strong>{{ currentEnemy?.name }}</strong></p>
      <p>Leben: {{ currentEnemy?.baseHealth }}</p>
      <button class="primary-btn" @click="endCombat">Kampf beenden (Test)</button>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useQuery } from '@vue/apollo-composable';
import { gql } from '@apollo/client/core';
import RunMapView from './RunMapView.vue';

const GET_MAP = gql`
  query GetMap {
    getMap {
      id
      name
      fields {
        id
        position
        x
        y
        type
        nextFields
        enemies {
          id
          name
          type
          baseHealth
          baseDamage
        }
      }
    }
  }
`;

const { result: mapResult } = useQuery(GET_MAP);

const mapFields = computed(() => mapResult.value?.getMap?.fields ?? []);

const phase = ref('map');        // 'map' | 'combat'
const mapPhase = ref('select-start');  // 'select-start' | 'select-next'
const currentPosition = ref(null);
const currentEnemy = ref(null);

function onFieldSelected(field) {
  currentPosition.value = field.position;

  if (field.type === 'FIGHT' || field.type === 'BOSS') {
    currentEnemy.value = field.enemies?.[0] || null;
    phase.value = 'combat';
  } else if (field.type === 'HEAL') {
    // TODO: Heilung anwenden
    mapPhase.value = 'select-next';
  } else {
    // START oder NORMAL
    mapPhase.value = 'select-next';
  }
}

function endCombat() {
  phase.value = 'map';
  mapPhase.value = 'select-next';
  currentEnemy.value = null;
}
</script>

<style scoped>
.run-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.combat-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  height: 100%;
  text-align: center;
}

.combat-placeholder h2 {
  font-size: 2rem;
}
</style>