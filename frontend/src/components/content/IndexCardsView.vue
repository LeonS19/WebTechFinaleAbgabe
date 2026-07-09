<template>
  <div v-if="showCheatWarning" class="cheat-warning" @click="showCheatWarning = false">
      Netter Versuch! Während eines laufenden Runs bleiben die Antworten tabu.
  </div>
  <div class="index-cards-view">
    <div class="toolbar">
      <input
        v-model="search"
        type="text"
        placeholder="Suche nach Frage oder Antwort..."
        class="search-input"
      />
      <select v-model="selectedUser" class="filter-select">
        <option value="">Alle Ersteller</option>
        <option v-for="user in availableUsers" :key="user.id" :value="user.id">
          {{ user.name }}
        </option>
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
        >{{ tag }}</span
      >
    </div>

    <div class="cards-grid">
      <div v-if="canCreate" class="card-wrapper card-create" @click="showCreate = true">
        <span class="plus-icon">+</span>
      </div>

    <index-card
      v-for="card in filteredCards"
      :key="card.id"
      :card-id="card.id"
      :question="card.question"
      :answer="card.answer"
      :creator="card.creator?.name || 'Unbekannt'"
      :tags="card.tags"
      :has-attachment="card.attachments && card.attachments.length > 0"
      :blocked="hasActiveRun"
    />
    </div>

    <IndexCardDetailModal
      v-if="detailCard"
      :card="detailCard"
      :userRole="userRole"
      @close="detailCard = null"
      @attachmentUploaded="emit('cardCreated')"
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
import { onMounted, onUnmounted, ref, computed } from 'vue'
import IndexCardDetailModal from './IndexCardDetailModal.vue'
import CreateIndexCardModal from './CreateIndexCardModal.vue'
import { useQuery } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'

const props = defineProps({
  cards: { type: Array, default: () => [] },
  userRole: String,
  studyGroupId: String,
})

const emit = defineEmits(['cardCreated'])

const search = ref('')
const selectedUser = ref('')
const selectedTags = ref([])
const sortOrder = ref('desc')
const detailCard = ref(null)
const showCreate = ref(false)
const showCheatWarning = ref(false)

const canCreate = computed(() => props.userRole === 'ADMIN' || props.userRole === 'MODERATOR')

const availableUsers = computed(() => {
  const map = new Map()
  props.cards.forEach((c) => {
    if (c.creator) map.set(c.creator.id, c.creator)
  })
  return [...map.values()]
})

const availableTags = computed(() => {
  return [...new Set(props.cards.flatMap((c) => c.tags || []))]
})

const filteredCards = computed(() => {
  let result = [...props.cards]
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    result = result.filter(
      (c) => c.question.toLowerCase().includes(q) || c.answer.toLowerCase().includes(q),
    )
  }
  if (selectedUser.value) {
    result = result.filter((c) => c.creator?.id === selectedUser.value)
  }
  if (selectedTags.value.length) {
    result = result.filter((c) => selectedTags.value.every((t) => c.tags.includes(t)))
  }
  result.sort((a, b) => {
    const diff = new Date(a.createdAt) - new Date(b.createdAt)
    return sortOrder.value === 'asc' ? diff : -diff
  })
  return result
})

const GET_ACTIVE_RUN = gql`
  query GetActiveRun($studyGroupId: ID!) {
    getActiveRun(studyGroupId: $studyGroupId) {
      id
    }
  }
`

const { result: activeRunResult } = useQuery(
  GET_ACTIVE_RUN,
  () => ({ studyGroupId: props.studyGroupId }),
  () => ({
    enabled: !!props.studyGroupId,
    pollInterval: 5000,
    fetchPolicy: 'network-only',
  }),
)

const hasActiveRun = computed(() => !!activeRunResult.value?.getActiveRun)

function toggleTag(tag) {
  if (selectedTags.value.includes(tag)) {
    selectedTags.value = selectedTags.value.filter((t) => t !== tag)
  } else {
    selectedTags.value.push(tag)
  }
}

function onCreated(card) {
  emit('cardCreated', card)
}

function handleDetailEvent(e) {
  if (hasActiveRun.value) return
  const cardId = e.detail?.cardId
  if (cardId) {
    detailCard.value = props.cards.find((c) => c.id === cardId) || null
  }
}

function handleBlockedEvent() {
  window.open('https://de.wikipedia.org/wiki/T%C3%A4uschung'), '_blank';
  showCheatWarning.value = true
}

onMounted(() => {
  document.addEventListener('index-card-detail', handleDetailEvent)
  document.addEventListener('index-card-blocked', handleBlockedEvent)
})

onUnmounted(() => {
  document.removeEventListener('index-card-detail', handleDetailEvent)
  document.removeEventListener('index-card-blocked', handleBlockedEvent)
})
</script>