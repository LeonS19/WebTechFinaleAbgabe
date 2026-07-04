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
        :src="n <= difficulty ? starFilled : starEmpty"
        class="star-icon"
      />
    </div>
    <p class="hand-card-question">{{ card.question }}</p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import cardBg from '../../assets/gui/index_card.png';
import starFilled from '../../assets/gui/star_filled.png';
import starEmpty from '../../assets/gui/star_empty.png';

const props = defineProps({
  card: Object,
  index: Number,
  total: Number,
});

defineEmits(['play']);

const hovered = ref(false);

const difficulty = computed(() => {
  const stats = props.card.groupStats?.[0];
  if (!stats || stats.totalAttempts === 0) return 0;
  return Math.round((stats.correctAnswers / stats.totalAttempts) * 5);
});

const cardStyle = computed(() => {
  const mid = (props.total - 1) / 2;
  const offset = props.index - mid;
  const rotate = offset * 7;
  const translateX = offset * 85;
  const translateY = hovered.value ? -3 * 16 : Math.abs(offset) * 15;
  const scale = hovered.value ? 1.1 : 1;
  const zIndex = hovered.value ? 10 : props.index;

  return {
    transform: `translateX(${translateX}px) translateY(${translateY}px) rotate(${rotate}deg) scale(${scale})`,
    zIndex,
    transition: 'transform 0.2s ease',
    position: 'absolute',
    backgroundImage: `url(${cardBg})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
});
</script>

<style scoped>
.hand-card {
  width: 22rem;
  height: 15rem;
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