<template>
  <div class="card-wrapper" @click="$emit('click')">
    <div class="card" :class="{ flipped }" @click.stop="flipped = !flipped">

      <div class="card-front">
        <span class="card-creator">{{ card.creator?.name || 'Unbekannt' }}</span>
        <p class="card-question">{{ card.question }}</p>
        <div class="card-tags">
          <span v-for="tag in card.tags" :key="tag" class="tag-chip">{{ tag }}</span>
        </div>
      </div>

      <div class="card-back">
        <p class="card-answer">{{ card.answer }}</p>
      </div>

    </div>
    <button class="card-detail-btn" @click.stop="$emit('detail')">Details</button>
  </div>
</template>

<script setup>
import { ref } from 'vue';

defineProps({ card: Object });
defineEmits(['detail']);

const flipped = ref(false);
</script>