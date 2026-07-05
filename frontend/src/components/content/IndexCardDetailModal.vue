<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal modal-large">
      <div class="modal-header">
        <h2>Karteikarte</h2>
        <button class="modal-close" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <div class="detail-section">
          <p class="detail-label">Frage</p>
          <p class="detail-value">{{ card.question }}</p>
        </div>
        <div class="detail-section">
          <p class="detail-label">Antwort</p>
          <p class="detail-value">{{ card.answer }}</p>
        </div>

        <div class="detail-section">
          <p class="detail-label">Tags</p>
          <div class="card-tags">
            <span v-for="tag in card.tags" :key="tag" class="tag-chip">{{ tag }}</span>
          </div>
        </div>

        <div class="detail-section detail-meta">
          <span>Erstellt von <strong>{{ card.creator?.name }}</strong></span>
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
          <div class="stats-grid">
            <div class="stat-box" v-for="stat in card.userStats" :key="stat.userId">
              <span class="stat-value">{{ stat.correctAnswers }} / {{ stat.totalAttempts }}</span>
              <span class="stat-label">Richtige Antworten</span>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <p class="detail-label">Anhänge</p>
          <div v-if="localAttachments.length" class="attachments-list">
            <div v-for="att in localAttachments" :key="att.id" class="attachment-item">
              <span>{{ att.filename }}</span>
              <button @click="downloadAttachment(att.id, att.filename)">
                Herunterladen
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
import { ref, computed } from 'vue';

const props = defineProps({
  card: Object,
  userRole: String,
});

const emit = defineEmits(['close', 'attachmentUploaded']);

const BASE_URL = 'http://localhost:3000/api/v1';

const localAttachments = ref([...(props.card.attachments || [])]);

const canUpload = computed(() =>
  props.userRole === 'ADMIN' || props.userRole === 'MODERATOR'
);

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('de-DE');
}

function difficulty(stat) {
  if (!stat.totalAttempts) return 0;
  return Math.round((stat.correctAnswers / stat.totalAttempts) * 100);
}

async function downloadAttachment(attachmentId, filename) {
  const token = localStorage.getItem('token')
  const res = await fetch(
    `${BASE_URL}/index-cards/${props.card.id}/attachments/${attachmentId}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )

  if (!res.ok) {
    console.error('Download fehlgeschlagen:', res.status)
    return
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename || 'anhang'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

async function handleUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  const token = localStorage.getItem('token');

  const res = await fetch(`${BASE_URL}/index-cards/${props.card.id}/attachments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (res.ok) {
    const newAttachment = await res.json();
    localAttachments.value.push(newAttachment);
    event.target.value = '';
    emit('attachmentUploaded', props.card.id);
  }
}
</script>