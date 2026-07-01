<template>
  <div class="index-cards-view">

    <div class="toolbar">
      <input v-model="search" type="text" placeholder="Suche nach Frage oder Antwort..." class="search-input" />
      <select v-model="selectedUser" class="filter-select">
        <option value="">Alle Ersteller</option>
        <option v-for="user in availableUsers" :key="user.id" :value="user.id">{{ user.name }}</option>
      </select>
      <select v-model="sortOrder" class="filter-select">
        <option value="desc">Neueste zuerst</option>
        <option value="asc">Älteste zuerst</option>
      </select>
    </div>

    <div class="tag-filters" v-if="availableTags.length">
      <span
        v-for="tag in availableTags"
        :key="tag"
        class="tag-chip"
        :class="{ active: selectedTags.includes(tag) }"
        @click="toggleTag(tag)"
      >{{ tag }}</span>
    </div>

    <div class="cards-grid">
      <IndexCardItem
        v-for="card in filteredCards"
        :key="card.id"
        :card="card"
        @detail="openDetail(card)"
      />
      <div v-if="canCreate" class="card-wrapper card-create" @click="showCreate = true">
        <span class="plus-icon">+</span>
      </div>
    </div>

    <IndexCardDetailModal
      v-if="detailCard"
      :card="detailCard"
      :userRole="userRole"
      @close="detailCard = null"
    />

    <CreateIndexCardModal
      v-if="showCreate"
      :studyGroupId="studyGroupId"
      @close="showCreate = false"
      @created="onCreated"
    />

  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import IndexCardItem from './IndexCardItem.vue';
import IndexCardDetailModal from './IndexCardDetailModal.vue';
import CreateIndexCardModal from './CreateIndexCardModal.vue';

const props = defineProps({
  cards: { type: Array, default: () => [] },
  userRole: String,
  studyGroupId: String,
});

const search = ref('');
const selectedUser = ref('');
const selectedTags = ref([]);
const sortOrder = ref('desc');
const detailCard = ref(null);
const showCreate = ref(false);

const canCreate = computed(() =>
  props.userRole === 'ADMIN' || props.userRole === 'MODERATOR'
);

const availableUsers = computed(() => {
  const map = new Map();
  props.cards.forEach(c => { if (c.creator) map.set(c.creator.id, c.creator); });
  return [...map.values()];
});

const availableTags = computed(() => {
  return [...new Set(props.cards.flatMap(c => c.tags || []))];
});

function toggleTag(tag) {
  if (selectedTags.value.includes(tag)) {
    selectedTags.value = selectedTags.value.filter(t => t !== tag);
  } else {
    selectedTags.value.push(tag);
  }
}

function openDetail(card) {
  detailCard.value = card;
}

function onCreated(card) {
  // TODO: nach echtem Backend-Call ersetzen
  console.log('Neue Karte:', card);
}

const filteredCards = computed(() => {
  let result = [...props.cards];
  if (search.value.trim()) {
    const q = search.value.toLowerCase();
    result = result.filter(c =>
      c.question.toLowerCase().includes(q) ||
      c.answer.toLowerCase().includes(q)
    );
  }
  if (selectedUser.value) {
    result = result.filter(c => c.creator?.id === selectedUser.value);
  }
  if (selectedTags.value.length) {
    result = result.filter(c =>
      selectedTags.value.every(t => c.tags.includes(t))
    );
  }
  result.sort((a, b) => {
    const diff = new Date(a.createdAt) - new Date(b.createdAt);
    return sortOrder.value === 'asc' ? diff : -diff;
  });
  return result;
});
</script>