<template>
  <div class="run-view">
    <RunMapView
      v-if="phase === 'map'"
      :fields="mapFields"
      :currentPosition="currentPosition"
      :phase="mapPhase"
      @fieldSelected="onFieldSelected"
    />

    <CombatView
      v-if="phase === 'combat'"
      ref="combatViewRef"
      :enemy="currentEnemy"
      :hand="placeholderHand"
      :deckCount="20"
      :playerHp="playerHp"
      :playerMaxHp="100"
      :enemyHp="enemyHp"
      @cardPlayed="onCardPlayed"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useQuery } from '@vue/apollo-composable';
import { gql } from '@apollo/client/core';
import RunMapView from './RunMapView.vue';
import CombatView from './CombatView.vue';

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

const phase = ref('map');
const mapPhase = ref('select-start');
const currentPosition = ref(null);
const currentEnemy = ref(null);
const playerHp = ref(100);
const enemyHp = ref(0);
const combatViewRef = ref(null);

// Placeholder Handkarten bis Backend fertig
const placeholderHand = ref([
  {
    id: '1',
    question: 'Was ist eine REST API?',
    answer: 'Ein Architekturstil für verteilte Systeme',
    groupStats: [{ totalAttempts: 10, correctAnswers: 8 }],
  },
  {
    id: '2',
    question: 'Was ist GraphQL?',
    answer: 'Eine Abfragesprache für APIs',
    groupStats: [{ totalAttempts: 5, correctAnswers: 2 }],
  },
  {
    id: '3',
    question: 'Was ist Vue.js?',
    answer: 'test',
    groupStats: [{ totalAttempts: 8, correctAnswers: 8 }],
  },
  {
    id: '4',
    question: 'Was ist ein Service Worker?',
    answer: 'Ein Skript das im Hintergrund läuft',
    groupStats: [{ totalAttempts: 3, correctAnswers: 1 }],
  },
  {
    id: '5',
    question: 'Was ist IndexedDB?',
    answer: 'Eine clientseitige Datenbank im Browser',
    groupStats: [{ totalAttempts: 6, correctAnswers: 3 }],
  },
]);

function onFieldSelected(field) {
  currentPosition.value = field.position;

  if (field.type === 'FIGHT' || field.type === 'BOSS') {
    currentEnemy.value = field.enemies?.[0] || null;
    enemyHp.value = currentEnemy.value?.baseHealth || 0;
    phase.value = 'combat';
  } else if (field.type === 'HEAL') {
    playerHp.value = Math.min(100, playerHp.value + 20);
    mapPhase.value = 'select-next';
  } else {
    mapPhase.value = 'select-next';
  }
}

async function onCardPlayed({ card, answer }) {
  // TODO: answerCard Mutation aufrufen
  const correct = answer.trim().toLowerCase() === card.answer.trim().toLowerCase();

  // CombatView kennt seine eigene Animations-Timing und meldet sich,
  // wenn der Treffer visuell "einschlägt" — erst dann wenden wir den Schaden an.
  await combatViewRef.value?.playCombatAnimation(correct);

  if (correct) {
    enemyHp.value = Math.max(0, enemyHp.value - 20);
  } else {
    playerHp.value = Math.max(0, playerHp.value - 10);
  }

  if (enemyHp.value <= 0) {
    phase.value = 'map';
    mapPhase.value = 'select-next';
    currentEnemy.value = null;
  }
}
</script>

<style scoped>
.run-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>