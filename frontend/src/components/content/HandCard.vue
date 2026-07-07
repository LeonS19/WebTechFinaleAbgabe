<template>
  <div
    class="hand-card"
    :style="cardStyle"
    @mouseenter="hovered = true"
    @mouseleave="hovered = false"
    @click="$emit('play', card)"
  >
    <div class="hand-card-stars">
      <img
        v-for="n in 5"
        :key="n"
        :src="n <= stars ? starFilled : starEmpty"
        class="star-icon"
      />
    </div>
    <p class="hand-card-question">{{ card.question }}</p>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import cardBg from '../../assets/gui/index_card.png';
import starFilled from '../../assets/gui/star_filled.png';
import starEmpty from '../../assets/gui/star_empty.png';

const props = defineProps({
  card: Object,
  index: Number,
  total: Number,
  // true, wenn die Karte gerade neu nachgezogen wurde -> spielt die Fly-in-Animation
  isNew: { type: Boolean, default: false },
  // optionale Verzögerung (ms), falls mehrere Karten gestaffelt nachgezogen werden
  enterDelay: { type: Number, default: 0 },
});

defineEmits(['play']);

const hovered = ref(false);
// Solange `entering` true ist, wird die Karte unterhalb des Stapels und unsichtbar
// gerendert (ohne Transition). Direkt danach (nächster Frame) wird sie auf false
// gesetzt, wodurch die normale Transition sie an ihre Fächer-Position hochgleiten lässt.
const entering = ref(props.isNew);

onMounted(async () => {
  if (!props.isNew) return;
  await nextTick();
  requestAnimationFrame(() => {
    entering.value = false;
  });
});

// Spiegelt die Backend-Formel aus deckBuilder/combat: kartenSchaden = 1 + (1 - difficulty) * 4
// difficulty = correctAnswers / totalAttempts (0, falls noch nie beantwortet)
const groupStat = computed(() => props.card.groupStats?.[0] ?? null);

const difficulty = computed(() => {
  if (!groupStat.value || !groupStat.value.totalAttempts) return 0;
  return groupStat.value.correctAnswers / groupStat.value.totalAttempts;
});

const stars = computed(() => {
  const rawDamage = 1 + (1 - difficulty.value) * 4;
  return Math.min(5, Math.max(1, Math.round(rawDamage)));
});

const cardStyle = computed(() => {
  const mid = (props.total - 1) / 2;
  const offset = props.index - mid;
  const rotate = offset * 7;
  const translateX = offset * 85;

  if (entering.value) {
    // Startzustand: weit unten, leicht verkleinert, unsichtbar, ohne Transition
    return {
      transform: `translateX(${translateX}px) translateY(400px) rotate(${rotate}deg) scale(0.8)`,
      opacity: 0,
      zIndex: props.index,
      transition: 'none',
      position: 'absolute',
      backgroundImage: `url(${cardBg})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    };
  }

  const translateY = hovered.value ? -3 * 16 : Math.abs(offset) * 15;
  const scale = hovered.value ? 1.1 : 1;
  const zIndex = hovered.value ? 10 : props.index;

  return {
    transform: `translateX(${translateX}px) translateY(${translateY}px) rotate(${rotate}deg) scale(${scale})`,
    opacity: 1,
    zIndex,
    transition: `transform 0.4s ease, opacity 0.4s ease`,
    transitionDelay: `${props.enterDelay}ms`,
    position: 'absolute',
    backgroundImage: `url(${cardBg})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
});
</script>

<style scoped>
.hand-card {
  width: 25rem;
  height: 17rem;
  border-radius: 0.5rem;
  padding: 1.25rem 1.25rem 0.85rem 1.25rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
  box-shadow: 0 0.25rem 0.75rem rgba(0,0,0,0.2);
}

.hand-card-stars {
  display: flex;
  gap: 0.4rem;
  justify-content: center;
  margin-top: auto;  /* ← schiebt Sterne nach unten */
}

.star-icon {
  width: 1.6rem;
  height: 1.6rem;
  image-rendering: pixelated;
}

.hand-card-question {
  font-size: 1.25rem;
  flex: 1;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  margin: 0;
  color: #2c3e50;
  text-align: center;
}

.hand-card-play:hover {
  background: #3a7ae0;
}
</style>