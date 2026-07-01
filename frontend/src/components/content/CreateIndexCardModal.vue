<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">

      <div class="modal-header">
        <h2>Neue Karteikarte</h2>
        <button class="modal-close" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <div class="form-group">
          <label>Frage</label>
          <textarea v-model="form.question" rows="4" placeholder="Frage eingeben..." />
        </div>

        <div class="form-group">
          <label>Antwort</label>
          <textarea v-model="form.answer" rows="4" placeholder="Antwort eingeben..." />
        </div>

        <div class="form-group">
          <label>Tags</label>
          <div class="tag-input-area">
            <div class="card-tags">
              <span v-for="tag in form.tags" :key="tag" class="tag-chip tag-removable">
                {{ tag }}
                <span @click="removeTag(tag)">✕</span>
              </span>
            </div>
            <input
              v-model="tagInput"
              type="text"
              placeholder="Tag eingeben + Enter"
              @keydown.enter.prevent="addTag"
            />
          </div>
        </div>

        <div class="form-group">
          <label>Dateien anhängen</label>
          <input type="file" multiple @change="handleFiles" class="file-input" />
          <div v-if="selectedFiles.length" class="selected-files">
            <div v-for="file in selectedFiles" :key="file.name" class="selected-file">
              <span>{{ file.name }}</span>
              <span class="file-size">{{ formatSize(file.size) }}</span>
            </div>
          </div>
        </div>

        <p v-if="error" class="error-msg">{{ error }}</p>
        <div class="modal-actions">
          <button class="cancel-btn" @click="$emit('close')">Abbrechen</button>
          <button class="primary-btn" @click="submit" :disabled="loading">
            {{ loading ? 'Wird erstellt...' : 'Erstellen' }}
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useMutation } from '@vue/apollo-composable';
import { gql } from '@apollo/client/core';

const props = defineProps({
  studyGroupId: String,
});

const emit = defineEmits(['close', 'created']);

const form = ref({ question: '', answer: '', tags: [] });
const tagInput = ref('');
const selectedFiles = ref([]);
const error = ref('');
const loading = ref(false);

const CREATE_INDEX_CARD = gql`
  mutation CreateIndexCard($studyGroupId: ID!, $question: String!, $answer: String!, $tags: [String!]) {
    createIndexCard(studyGroupId: $studyGroupId, question: $question, answer: $answer, tags: $tags) {
      id
      studyGroupId
      question
      answer
      tags
      createdAt
      creator { id name }
    }
  }
`;

const { mutate: createIndexCard } = useMutation(CREATE_INDEX_CARD);

function addTag() {
  const t = tagInput.value.trim();
  if (t && !form.value.tags.includes(t)) {
    form.value.tags.push(t);
  }
  tagInput.value = '';
}

function removeTag(tag) {
  form.value.tags = form.value.tags.filter(t => t !== tag);
}

function handleFiles(event) {
  selectedFiles.value = [...event.target.files];
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function submit() {
  if (!form.value.question.trim() || !form.value.answer.trim()) return;
  loading.value = true;
  error.value = '';
  try {
    const result = await createIndexCard({
      studyGroupId: props.studyGroupId,
      question: form.value.question.trim(),
      answer: form.value.answer.trim(),
      tags: form.value.tags,
    });
    emit('created', result.data.createIndexCard);
    emit('close');
  } catch (err) {
    error.value = err.message || 'Fehler beim Erstellen';
  } finally {
    loading.value = false;
  }
}
</script>