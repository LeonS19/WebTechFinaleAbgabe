<template>
  <div class="run-history-view">
    <div class="history-header">
      <h2>Run Historie</h2>
      <p class="history-subtitle">Deine bisherigen Runs in dieser Lerngruppe</p>
    </div>

    <p v-if="loading" class="history-loading">Historie wird geladen...</p>
    <p v-else-if="error" class="history-error">{{ error.message }}</p>
    <p v-else-if="runs.length === 0" class="history-empty">
      Du hast in dieser Lerngruppe noch keinen Run gespielt.
    </p>

    <template v-else>
      <div class="stats-row">
        <div
          class="stat-card"
          :data-tooltip="`${stats.successfulRuns} von ${stats.totalRuns} Runs erfolgreich abgeschlossen`"
        >
          <span class="stat-value">{{ stats.successfulRuns }}/{{ stats.totalRuns }}</span>
          <span class="stat-label">Runs erfolgreich</span>
        </div>
        <div
          class="stat-card"
          :data-tooltip="`${stats.totalCorrect} von ${stats.totalAnswered} beantworteten Karten richtig`"
        >
          <span class="stat-value">{{ stats.totalCorrect }}/{{ stats.totalAnswered }}</span>
          <span class="stat-label">Karten richtig</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ formatHitRate(stats.avgHitRate) }}</span>
          <span class="stat-label">⌀ Trefferquote</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ formatDuration(stats.avgDuration) }}</span>
          <span class="stat-label">⌀ Rundendauer</span>
        </div>
      </div>

      <table class="history-table">
        <thead>
          <tr>
            <th>Datum</th>
            <th>Status</th>
            <th>Richtige Antworten</th>
            <th>Trefferquote</th>
            <th>Dauer</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="run in runs" :key="run.id">
            <td>{{ formatDate(run.startTime) }}</td>
            <td>
              <span :class="['status-badge', statusClass(run.successful)]">
                {{ statusLabel(run.successful) }}
              </span>
            </td>
            <td :data-tooltip="`${run.correctAnswers} von ${run.totalAnswers} Karten richtig beantwortet`">
              {{ run.correctAnswers }} / {{ run.totalAnswers }}
            </td>
            <td>{{ formatHitRate(run.hitRate) }}</td>
            <td>{{ formatDuration(run.duration) }}</td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { gql } from '@apollo/client/core';
import { useOfflineAwareQuery } from '../../composables/useOfflineAwareQuery.js'
import { getCachedRuns } from '../../services/offlineStorage.service.js'

const props = defineProps({
  studyGroupId: { type: String, required: true },
});

const GET_RUNS = gql`
  query GetRuns {
    getRuns {
      id
      studyGroup {
        id
      }
      successful
      startTime
      duration
      correctAnswers
      totalAnswers
      hitRate
    }
  }
`;

const { data: runsData, loading, error } = useOfflineAwareQuery(
  GET_RUNS,
  () => ({}),
  () => ({}),
  {
    dataKey: 'getRuns',
    cacheFn: () => getCachedRuns(props.studyGroupId),
  },
)

const runs = computed(() =>
  (runsData.value ?? []).filter((run) => run.studyGroup?.id === props.studyGroupId),
)

// Zusammenfassung über alle geladenen Runs dieser Lerngruppe — rein clientseitig
// berechnet, keine eigene Backend-Query nötig.
const stats = computed(() => {
  const totalRuns = runs.value.length;
  const successfulRuns = runs.value.filter((r) => r.successful === true).length;

  const totalAnswered = runs.value.reduce((sum, r) => sum + (r.totalAnswers ?? 0), 0);
  const totalCorrect = runs.value.reduce((sum, r) => sum + (r.correctAnswers ?? 0), 0);

  // Gesamt-gewichtete Trefferquote (nicht der einfache Mittelwert der Run-Quoten) —
  // Runs mit mehr beantworteten Karten fließen dadurch stärker in den Schnitt ein.
  const avgHitRate = totalAnswered > 0 ? totalCorrect / totalAnswered : null;

  // Nur abgeschlossene Runs haben eine duration — noch laufende (successful === null) ausgeschlossen
  const durations = runs.value.map((r) => r.duration).filter((d) => d != null);
  const avgDuration =
    durations.length > 0
      ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length)
      : null;

  return { totalRuns, successfulRuns, totalAnswered, totalCorrect, avgHitRate, avgDuration };
});

function statusLabel(successful) {
  if (successful === true) return 'Erfolgreich';
  if (successful === false) return 'Gescheitert';
  return 'Läuft noch';
}

function statusClass(successful) {
  if (successful === true) return 'status-success';
  if (successful === false) return 'status-failed';
  return 'status-active';
}

function formatHitRate(hitRate) {
  if (hitRate == null) return '–';
  return `${Math.round(hitRate * 100)}%`;
}

function formatDuration(seconds) {
  if (seconds == null) return '–';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

function formatDate(startTime) {
  const date = new Date(Number(startTime) || startTime);
  if (Number.isNaN(date.getTime())) return '–';
  return date.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
</script>

<style scoped>
.run-history-view {
  padding: 1.5rem 2rem;
  height: 100%;
  overflow-y: auto;
}

.history-header {
  margin-bottom: 1.5rem;
}

.history-header h2 {
  margin: 0 0 0.25rem 0;
}

.history-subtitle {
  margin: 0;
  color: var(--color-text);
  opacity: 0.7;
  font-size: 0.9rem;
}

.history-loading,
.history-error,
.history-empty {
  padding: 1rem;
  color: var(--color-text);
  opacity: 0.75;
}

.history-error {
  color: #dc2626;
  opacity: 1;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 0.6rem;
  background: var(--color-background-soft);
}

[data-tooltip] {
  position: relative;
  cursor: help;
}

[data-tooltip]::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: calc(100% + 0.5rem);
  left: 50%;
  transform: translateX(-50%);
  background: #1a1a1a;
  color: #fff;
  padding: 0.4rem 0.7rem;
  border-radius: 0.4rem;
  font-size: 0.75rem;
  font-weight: 500;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.08s ease;
  z-index: 20;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

[data-tooltip]:hover::after {
  opacity: 1;
  visibility: visible;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
}

.stat-label {
  font-size: 0.8rem;
  color: var(--color-text);
  opacity: 0.7;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
}

.history-table th,
.history-table td {
  text-align: left;
  padding: 0.6rem 0.9rem;
  border-bottom: 1px solid var(--color-border);
}

.history-table th {
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--color-text);
  opacity: 0.6;
}

.history-table tbody tr:hover {
  background: var(--color-background-mute);
}

.status-badge {
  display: inline-block;
  padding: 0.15rem 0.6rem;
  border-radius: 1rem;
  font-size: 0.8rem;
  font-weight: 600;
}

.status-success {
  background: #dcfce7;
  color: #166534;
}

.status-failed {
  background: #fee2e2;
  color: #991b1b;
}

.status-active {
  background: var(--color-background-mute);
  color: var(--color-text);
  opacity: 0.8;
}
</style>