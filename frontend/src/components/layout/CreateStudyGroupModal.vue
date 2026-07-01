<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2>Neue Lerngruppe</h2>
        <button class="modal-close" @click="$emit('close')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label>Gruppenname</label>
          <input v-model="name" type="text" placeholder="Name eingeben..." />
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

const emit = defineEmits(['close', 'created']);

const name = ref('');
const error = ref('');
const loading = ref(false);

const CREATE_STUDY_GROUP = gql`
  mutation CreateStudyGroup($name: String!) {
    createStudyGroup(name: $name) {
      id
      name
      chatId
      createdAt
    }
  }
`;

const { mutate: createStudyGroup } = useMutation(CREATE_STUDY_GROUP);

async function submit() {
  if (!name.value.trim()) {
    error.value = 'Bitte einen Namen eingeben';
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const result = await createStudyGroup({ name: name.value.trim() });
    emit('created', result.data.createStudyGroup);
    emit('close');
  } catch (err) {
    error.value = err.message || 'Fehler beim Erstellen';
  } finally {
    loading.value = false;
  }
}
</script>