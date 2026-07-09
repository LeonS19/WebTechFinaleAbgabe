<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal modal-large">
      <div class="modal-header">
        <h2>Karteikarte</h2>
        <button class="modal-close" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <div class="detail-section">
          <div class="detail-label-row">
            <p class="detail-label">Frage</p>
            <div v-if="canEdit && !isEditing" class="detail-actions">
              <button class="edit-btn" @click="startEdit">Bearbeiten</button>
              <button class="delete-card-btn" :disabled="deleting" @click="confirmDeleteCard">
                {{ deleting ? 'Wird gelöscht...' : 'Karte löschen' }}
              </button>
            </div>
          </div>
          <p v-if="deleteError" class="edit-error">{{ deleteError }}</p>
          <p v-if="!isEditing" class="detail-value">{{ question }}</p>
          <textarea v-else v-model="editQuestion" class="edit-textarea" rows="2"></textarea>
        </div>
        <div class="detail-section">
          <p class="detail-label">Antwort</p>
          <p v-if="!isEditing" class="detail-value">{{ answer }}</p>
          <textarea v-else v-model="editAnswer" class="edit-textarea" rows="2"></textarea>
        </div>

        <div v-if="isEditing" class="edit-actions">
          <p v-if="editError" class="edit-error">{{ editError }}</p>
          <button class="cancel-btn" :disabled="saving" @click="cancelEdit">Abbrechen</button>
          <button class="save-btn" :disabled="saving" @click="saveEdit">
            {{ saving ? 'Wird gespeichert...' : 'Speichern' }}
          </button>
        </div>

        <div class="detail-section">
          <p class="detail-label">Tags</p>
          <div class="card-tags">
            <span v-for="tag in card.tags" :key="tag" class="tag-chip">{{ tag }}</span>
          </div>
        </div>

        <div class="detail-section detail-meta">
          <span
            >Erstellt von <strong>{{ card.creator?.name }}</strong></span
          >
          <span>{{ formatDate(card.createdAt) }}</span>
        </div>

        <div class="detail-section">
          <p class="detail-label">Gruppenstatistik</p>
          <div class="stats-grid">
            <div class="stat-box" v-for="stat in card.groupStats" :key="stat.studyGroupId">
              <span class="stat-value">{{ difficulty(stat) }}%</span>
              <span class="stat-label">Schwierigkeitsgrad</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <p class="detail-label">Meine Statistik</p>
          <div v-if="myStat" class="stats-grid">
            <div class="stat-box">
              <span class="stat-value">{{ myStat.correctAnswers }} / {{ myStat.totalAttempts }}</span>
              <span class="stat-label">Richtige Antworten</span>
            </div>
          </div>
          <p v-else class="placeholder-small">Du hast diese Karte noch nicht beantwortet</p>
        </div>

        <div class="detail-section">
          <p class="detail-label">Anhänge</p>
          <div v-if="localAttachments.length" class="attachments-list">
            <div v-for="att in localAttachments" :key="att.id" class="attachment-item">
              <span>{{ att.filename }}</span>
              <button @click="downloadAttachment(att.id, att.filename)">Herunterladen</button>
              <button
                v-if="canUpload"
                class="delete-attachment-btn"
                :disabled="deletingAttachmentId === att.id"
                @click="deleteAttachment(att.id)"
              >
                {{ deletingAttachmentId === att.id ? '...' : '🗑' }}
              </button>
            </div>
          </div>
          <p v-else class="placeholder-small">Keine Anhänge vorhanden</p>

          <div v-if="canUpload" class="upload-area">
            <input type="file" @change="handleUpload" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useMutation } from '@vue/apollo-composable'
import { gql } from '@apollo/client/core'

const props = defineProps({
  card: Object,
  userRole: String,
  currentUserId: String,
})

const emit = defineEmits([
  'close',
  'attachmentUploaded',
  'attachmentDeleted',
  'cardUpdated',
  'cardDeleted',
])

const BASE_URL = 'http://localhost:3000/api/v1'

const localAttachments = ref([...(props.card.attachments || [])])

// Lokale Kopie von Frage/Antwort, damit das Modal nach dem Speichern sofort den
// neuen Stand zeigt, ohne dass der Elternkomponente die Liste neu laden muss.
const question = ref(props.card.question)
const answer = ref(props.card.answer)

const canUpload = computed(() => props.userRole === 'ADMIN' || props.userRole === 'MODERATOR')
const canEdit = computed(() => props.userRole === 'ADMIN' || props.userRole === 'MODERATOR')

// Nur die Statistik des aktuell eingeloggten Users — card.userStats enthält die
// Statistik aller Gruppenmitglieder zu dieser Karte, "Meine Statistik" soll aber
// nur meinen eigenen Eintrag zeigen.
const myStat = computed(() =>
  props.card.userStats?.find((stat) => stat.userId === props.currentUserId) ?? null,
)

// ---- Bearbeiten von Frage/Antwort ----
const UPDATE_INDEX_CARD = gql`
  mutation UpdateIndexCard($id: ID!, $question: String, $answer: String) {
    updateIndexCard(id: $id, question: $question, answer: $answer) {
      id
      question
      answer
    }
  }
`
const { mutate: updateIndexCardMutation } = useMutation(UPDATE_INDEX_CARD)

const isEditing = ref(false)
const editQuestion = ref('')
const editAnswer = ref('')
const editError = ref(null)
const saving = ref(false)

function startEdit() {
  editQuestion.value = question.value
  editAnswer.value = answer.value
  editError.value = null
  isEditing.value = true
}

function cancelEdit() {
  isEditing.value = false
  editError.value = null
}

async function saveEdit() {
  if (!editQuestion.value.trim() || !editAnswer.value.trim()) {
    editError.value = 'Frage und Antwort dürfen nicht leer sein.'
    return
  }

  saving.value = true
  editError.value = null

  try {
    const { data } = await updateIndexCardMutation({
      id: props.card.id,
      question: editQuestion.value.trim(),
      answer: editAnswer.value.trim(),
    })

    question.value = data.updateIndexCard.question
    answer.value = data.updateIndexCard.answer
    isEditing.value = false
    emit('cardUpdated', data.updateIndexCard)
  } catch (err) {
    editError.value = err.message ?? 'Speichern fehlgeschlagen.'
    console.error('updateIndexCard failed:', err)
  } finally {
    saving.value = false
  }
}

// ---- Karte löschen ----
const DELETE_INDEX_CARD = gql`
  mutation DeleteIndexCard($id: ID!) {
    deleteIndexCard(id: $id)
  }
`
const { mutate: deleteIndexCardMutation } = useMutation(DELETE_INDEX_CARD)

const deleting = ref(false)
const deleteError = ref(null)

async function confirmDeleteCard() {
  const confirmed = window.confirm(
    'Diese Karteikarte wirklich unwiderruflich löschen? Das kann nicht rückgängig gemacht werden.',
  )
  if (!confirmed) return

  deleting.value = true
  deleteError.value = null

  try {
    await deleteIndexCardMutation({ id: props.card.id })
    emit('cardDeleted', props.card.id)
    emit('close')
  } catch (err) {
    deleteError.value = err.message ?? 'Löschen fehlgeschlagen.'
    console.error('deleteIndexCard failed:', err)
  } finally {
    deleting.value = false
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('de-DE')
}

function difficulty(stat) {
  if (!stat.totalAttempts) return 0
  return Math.round((stat.correctAnswers / stat.totalAttempts) * 100)
}

async function downloadAttachment(attachmentId, filename) {
  const token = localStorage.getItem('token');
  const res = await fetch(
    `${BASE_URL}/index-cards/${props.card.id}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) {
    console.error('Download fehlgeschlagen:', res.status);
    return;
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

const deletingAttachmentId = ref(null)

async function deleteAttachment(attachmentId) {
  const confirmed = window.confirm('Diesen Anhang wirklich löschen?')
  if (!confirmed) return

  deletingAttachmentId.value = attachmentId
  const token = localStorage.getItem('token')

  try {
    const res = await fetch(
      `${BASE_URL}/index-cards/${props.card.id}/attachments/${attachmentId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      },
    )

    if (res.ok) {
      localAttachments.value = localAttachments.value.filter((a) => a.id !== attachmentId)
      emit('attachmentDeleted', props.card.id)
    } else {
      console.error('Löschen des Anhangs fehlgeschlagen:', res.status)
    }
  } catch (err) {
    console.error('Löschen des Anhangs fehlgeschlagen:', err)
  } finally {
    deletingAttachmentId.value = null
  }
}

async function handleUpload(event) {
  const file = event.target.files[0]
  if (!file) return
  const formData = new FormData()
  formData.append('file', file)
  const token = localStorage.getItem('token')

  const res = await fetch(`${BASE_URL}/index-cards/${props.card.id}/attachments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })

  if (res.ok) {
    const raw = await res.json()
    // Defensiv gemappt: das Backend gibt aktuell teils noch _id/snake_case zurück
    const newAttachment = {
      id: raw.id ?? raw._id,
      filename: raw.filename,
      mimeType: raw.mimeType ?? raw.mime_type,
      sizeInBytes: raw.sizeInBytes ?? raw.size_in_bytes,
      uploadedAt: raw.uploadedAt ?? raw.uploaded_at,
    }
    localAttachments.value.push(newAttachment)
    event.target.value = ''
    emit('attachmentUploaded', props.card.id)
  }
}
</script>