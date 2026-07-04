<template>
  <div class="combat-view">

    <!-- Obere Hälfte: Kampfarena -->
    <div class="combat-arena">

      <!-- Deck Counter oben rechts -->
      <div class="deck-counter">
        🃏 <span>{{ deckCount }}</span>
      </div>

      <!-- Player -->
      <div class="combat-side combat-player">
        <div class="health-bar-wrapper">
          <div class="health-bar" :style="{ width: playerHealthPercent + '%' }"></div>
          <span class="health-label">{{ playerHp }} / {{ playerMaxHp }}</span>
        </div>
        <div class="combat-sprite player-sprite">🧙</div>
        <span class="combat-name">Du</span>
      </div>

      <!-- VS -->
      <div class="combat-vs">VS</div>

      <!-- Gegner -->
      <div class="combat-side combat-enemy">
        <div class="health-bar-wrapper">
          <div class="health-bar enemy" :style="{ width: enemyHealthPercent + '%' }"></div>
          <span class="health-label">{{ enemyHp }} / {{ enemy?.baseHealth }}</span>
        </div>
        <div class="combat-sprite enemy-sprite">💀</div>
        <span class="combat-name">{{ enemy?.name }}</span>
      </div>

    </div>

    <!-- Untere Hälfte: Handkarten -->
    <div class="combat-hand">
      <div class="hand-cards">
        <HandCard
          v-for="(card, index) in hand"
          :key="card.id"
          :card="card"
          :index="index"
          :total="hand.length"
          @play="onPlayCard"
        />
      </div>
    </div>

    <!-- Overlay -->
    <CardPlayOverlay
      v-if="activeCard"
      :card="activeCard"
      @confirm="onConfirm"
      @close="activeCard = null"
    />

  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import HandCard from './HandCard.vue';
import CardPlayOverlay from './CardPlayOverlay.vue';

const props = defineProps({
  enemy: Object,
  hand: { type: Array, default: () => [] },
  deckCount: { type: Number, default: 0 },
  playerHp: { type: Number, default: 100 },
  playerMaxHp: { type: Number, default: 100 },
  enemyHp: { type: Number, default: 100 },
});

const emit = defineEmits(['cardPlayed']);

const activeCard = ref(null);

const playerHealthPercent = computed(() =>
  Math.max(0, Math.min(100, (props.playerHp / props.playerMaxHp) * 100))
);

const enemyHealthPercent = computed(() =>
  Math.max(0, Math.min(100, (props.enemyHp / (props.enemy?.baseHealth || 1)) * 100))
);

function onPlayCard(card) {
  activeCard.value = card;
}

function onConfirm(answer) {
  emit('cardPlayed', { card: activeCard.value, answer });
  activeCard.value = null;
}
</script>

<style scoped>
.combat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.combat-arena {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 2rem;
  position: relative;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--color-border);
}

.deck-counter {
  position: absolute;
  top: 1rem;
  right: 1rem;
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
}

.deck-counter span {
  font-size: 1.2rem;
}

.combat-side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  width: 12rem;
}

.health-bar-wrapper {
  width: 100%;
  height: 1rem;
  background: var(--color-background-mute);
  border-radius: 0.5rem;
  overflow: hidden;
  position: relative;
}

.health-bar {
  height: 100%;
  background: #4ade80;
  border-radius: 0.5rem;
  transition: width 0.3s ease;
}

.health-bar.enemy {
  background: #f87171;
}

.health-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.65rem;
  font-weight: 700;
  color: #1a1a1a;
}

.combat-sprite {
  font-size: 5rem;
  line-height: 1;
}

.combat-name {
  font-size: 0.9rem;
  font-weight: 600;
}

.combat-vs {
  font-size: 1.5rem;
  font-weight: 800;
  opacity: 0.3;
}

.combat-hand {
  flex: 1;  /* ← 50% */
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-background);
  padding: 0 2rem;
  overflow: hidden;
}

.hand-cards {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  position: relative;
  height: 100%;
  width: 100%;
}
</style>