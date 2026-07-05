<template>
  <div class="ranking-view">
    <div class="ranking-header">
      <h2>Bestenliste</h2>
      <p class="ranking-subtitle">Alle erfolgreichen Runs der Lerngruppe</p>
    </div>

    <p v-if="loading" class="ranking-loading">Rangliste wird geladen...</p>
    <p v-else-if="error" class="ranking-error">{{ error.message }}</p>
    <p v-else-if="ranking.length === 0" class="ranking-empty">
      Noch keine erfolgreichen Runs in dieser Gruppe — sei die/der Erste!
    </p>

    <table v-else class="ranking-table">
      <thead>
        <tr>
          <th>Platz</th>
          <th>Name</th>
          <th>Richtige Antworten</th>
          <th>Trefferquote</th>
          <th>Dauer</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in ranking" :key="`${entry.rank}-${entry.run.id}`">
          <td class="rank-cell">{{ entry.rank }}</td>
          <td>
            {{ entry.user.name }}
            <span v-if="entry.isFormerMember" class="former-member-label">ehemaliges Mitglied</span>
          </td>
          <td>{{ entry.correctAnswers }}</td>
          <td>{{ formatHitRate(entry.hitRate) }}</td>
          <td>{{ formatDuration(entry.duration) }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useQuery, useSubscription } from '@vue/apollo-composable';
import { gql } from '@apollo/client/core';

const props = defineProps({
  studyGroupId: { type: String, required: true },
});

const GET_RANKING = gql`
  query GetRanking($studyGroupId: ID!) {
    getRanking(studyGroupId: $studyGroupId) {
      rank
      correctAnswers
      hitRate
      duration
      isFormerMember
      user {
        id
        name
      }
      run {
        id
        startTime
      }
    }
  }
`;

const { result, loading, error } = useQuery(
  GET_RANKING,
  () => ({ studyGroupId: props.studyGroupId }),
  () => ({ enabled: !!props.studyGroupId, fetchPolicy: 'cache-and-network' }),
);

// Live-Update, sobald irgendjemand in der Gruppe einen Run beendet — Server schickt
// die komplett neu berechnete Rangliste, wir übernehmen sie 1:1.
const ON_RANKING_UPDATED = gql`
  subscription OnRankingUpdated($studyGroupId: ID!) {
    onRankingUpdated(studyGroupId: $studyGroupId) {
      rank
      correctAnswers
      hitRate
      duration
      isFormerMember
      user {
        id
        name
      }
      run {
        id
        startTime
      }
    }
  }
`;
const { result: rankingUpdateResult } = useSubscription(
  ON_RANKING_UPDATED,
  () => ({ studyGroupId: props.studyGroupId }),
  () => ({ enabled: !!props.studyGroupId }),
);

const ranking = computed(() => {
  return rankingUpdateResult.value?.onRankingUpdated ?? result.value?.getRanking ?? [];
});

function formatHitRate(hitRate) {
  return `${Math.round(hitRate * 100)}%`;
}

function formatDuration(seconds) {
  if (seconds == null) return '–';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}
</script>

<style scoped>
.ranking-view {
  padding: 1.5rem 2rem;
  height: 100%;
  overflow-y: auto;
}

.ranking-header {
  margin-bottom: 1.5rem;
}

.ranking-header h2 {
  margin: 0 0 0.25rem 0;
}

.ranking-subtitle {
  margin: 0;
  color: var(--color-text);
  opacity: 0.7;
  font-size: 0.9rem;
}

.ranking-loading,
.ranking-error,
.ranking-empty {
  padding: 1rem;
  color: var(--color-text);
  opacity: 0.75;
}

.ranking-error {
  color: #dc2626;
  opacity: 1;
}

.ranking-table {
  width: 100%;
  border-collapse: collapse;
}

.ranking-table th,
.ranking-table td {
  text-align: left;
  padding: 0.6rem 0.9rem;
  border-bottom: 1px solid var(--color-border);
}

.ranking-table th {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text);
  opacity: 0.6;
}

.rank-cell {
  font-weight: 700;
}

.former-member-label {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.1rem 0.5rem;
  font-size: 0.7rem;
  border-radius: 1rem;
  background: var(--color-background-mute);
  color: var(--color-text);
  opacity: 0.65;
  vertical-align: middle;
}

.ranking-table tbody tr:hover {
  background: var(--color-background-mute);
}
</style>