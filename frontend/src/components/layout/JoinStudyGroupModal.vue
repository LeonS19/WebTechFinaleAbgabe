<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2>Lerngruppe beitreten</h2>
        <button class="modal-close" @click="$emit('close')">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <input
            v-model="search"
            type="text"
            placeholder="Nach Gruppenname suchen..."
            :disabled="isOffline"
            @input="onSearch"
          />

          <p v-if="isOffline" class="error-msg">Suche und Beitritt benötigen eine Internetverbindung</p>
        </div>

        <div class="groups-list">
          <p v-if="loading" class="placeholder-small">Lädt...</p>
          <p v-else-if="groups.length === 0" class="placeholder-small">Keine Gruppen gefunden</p>
          <div
            v-for="group in groups"
            :key="group.id"
            class="group-list-item"
            :class="{ joined: isJoined(group.id) }"
          >
            <span>{{ group.name }}</span>
            <button
              v-if="!isJoined(group.id)"
              class="primary-btn"
              @click="join(group)"
              :disabled="joiningId === group.id"
            >
              {{ joiningId === group.id ? '...' : 'Beitreten' }}
            </button>
            <span v-else class="already-joined">✓ Beigetreten</span>
          </div>
        </div>

        <p v-if="error" class="error-msg">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useQuery, useMutation } from '@vue/apollo-composable';
import { gql } from '@apollo/client/core';

const props = defineProps({
  joinedGroupIds: Array,
});

const emit = defineEmits(['close', 'joined']);

const search = ref('');
const groups = ref([]);
const loading = ref(false);
const joiningId = ref(null);
const error = ref('');
const isOffline = ref(!navigator.onLine)

const GET_STUDY_GROUPS = gql`
  query GetStudyGroups($search: String) {
    getStudyGroups(search: $search) {
      id
      name
      createdAt
    }
  }
`;

const JOIN_STUDY_GROUP = gql`
  mutation JoinStudyGroup($studyGroupId: ID!) {
    joinStudyGroup(studyGroupId: $studyGroupId) {
      role
      user {
        id
        name
      }
    }
  }
`;

const { refetch } = useQuery(GET_STUDY_GROUPS, { search: '' }, {
  onResult(queryResult) {
    groups.value = queryResult.data?.getStudyGroups ?? [];
  }
});

const { mutate: joinStudyGroup } = useMutation(JOIN_STUDY_GROUP);

function updateOnlineStatus() {
  isOffline.value = !navigator.onLine
}

onMounted(() => {
  loadGroups()
  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)
})

onUnmounted(() => {
  window.removeEventListener('online', updateOnlineStatus)
  window.removeEventListener('offline', updateOnlineStatus)
})


async function loadGroups() {
  loading.value = true;
  try {
    const result = await refetch({ search: search.value });
    groups.value = result.data?.getStudyGroups ?? [];
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  loadGroups();
}

function isJoined(groupId) {
  return props.joinedGroupIds?.includes(groupId);
}

async function join(group) {
  if (isOffline.value) {
    error.value = 'Lerngruppen beitreten benötigt eine Internetverbindung'
    return
  }
  joiningId.value = group.id;
  error.value = '';
  try {
    await joinStudyGroup({ studyGroupId: group.id });
    emit('joined', group);
  } catch (err) {
    error.value = err.message || 'Fehler beim Beitreten';
  } finally {
    joiningId.value = null;
  }
}
</script>