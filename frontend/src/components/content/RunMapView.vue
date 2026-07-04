<template>
  <div class="run-map-view">

    <!-- Header nur am Anfang -->
    <div class="run-map-header" v-if="phase === 'select-start'">
      <p class="run-map-hint">Wähle dein Startfeld:</p>
    </div>

    <!-- Legende danach -->
    <div class="run-map-legend" v-else>
      <span class="legend-item"><span class="field-icon">💎</span> Start</span>
      <span class="legend-item"><span class="field-icon">🧪</span> Heilung</span>
      <span class="legend-item"><span class="field-icon">💀</span> Kampf</span>
      <span class="legend-item"><span class="field-icon">👑</span> Boss</span>
      <span class="legend-item"><span class="field-icon">⬜</span> Normal</span>
    </div>

    <!-- Map Canvas -->
    <div class="run-map-canvas-wrapper">
      <svg
        v-if="fields.length"
        :viewBox="`-1 -1 ${svgWidth + 2} ${svgHeight + 2}`"
        class="run-map-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <!-- Pfeile zwischen Feldern -->
        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="#888" />
          </marker>
        </defs>

        <line
          v-for="arrow in arrows"
          :key="arrow.key"
          :x1="arrow.x1"
          :y1="arrow.y1"
          :x2="arrow.x2"
          :y2="arrow.y2"
          stroke="#888"
          stroke-width="0.3"
          marker-end="url(#arrowhead)"
        />

        <!-- Felder -->
        <g
          v-for="field in fields"
          :key="field.id"
          :transform="`translate(${fieldX(field)}, ${fieldY(field)})`"
          @click="onFieldClick(field)"
          style="cursor: pointer"
        >
          <!-- Kreis -->
          <circle
            r="1.8"
            :fill="fieldFill(field)"
            :stroke="fieldStroke(field)"
            :stroke-width="isSelectable(field) ? 0.5 : 0.2"
            :class="{ 'field-pulse': isSelectable(field) }"
          />

          <!-- Icon -->
          <text
            text-anchor="middle"
            dominant-baseline="central"
            font-size="1.5"
            style="pointer-events: none; user-select: none"
          >
            {{ fieldIcon(field) }}
          </text>
        </g>
      </svg>

      <p v-else class="placeholder">Map wird geladen...</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  fields: { type: Array, default: () => [] },
  currentPosition: { type: Number, default: null },
  phase: { type: String, default: 'select-start' }, // 'select-start' | 'select-next'
})

const emit = defineEmits(['fieldSelected'])

const CELL_W = 8;
const CELL_H = 8;   // ← größer damit mehr vertikaler Abstand
const PADDING = 5;

const svgWidth = computed(() => {
  if (!props.fields.length) return 100
  const maxX = Math.max(...props.fields.map((f) => f.x))
  return (maxX + 1) * CELL_W + PADDING * 2
})

const svgHeight = computed(() => {
  if (!props.fields.length) return 100
  const maxY = Math.max(...props.fields.map((f) => f.y))
  return (maxY + 1) * CELL_H + PADDING * 2
})

function fieldX(field) {
  return field.x * CELL_W + PADDING
}

function fieldY(field) {
  return field.y * CELL_H + PADDING
}

const fieldMap = computed(() => {
  const map = new Map()
  props.fields.forEach((f) => map.set(f.position, f))
  return map
})

const arrows = computed(() => {
  const result = []
  props.fields.forEach((field) => {
    ;(field.nextFields || []).forEach((nextPos) => {
      const next = fieldMap.value.get(nextPos)
      if (!next) return

      const x1 = fieldX(field)
      const y1 = fieldY(field)
      const x2 = fieldX(next)
      const y2 = fieldY(next)

      // Richtungsvektor kürzen damit Pfeil nicht im Kreis endet
      const dx = x2 - x1
      const dy = y2 - y1
      const len = Math.sqrt(dx * dx + dy * dy)
      const ux = dx / len
      const uy = dy / len
      const radius = 1.8

      result.push({
        key: `${field.position}-${nextPos}`,
        x1: x1 + ux * radius,
        y1: y1 + uy * radius,
        x2: x2 - ux * (radius + 1.5),
        y2: y2 - uy * (radius + 1.5),
      })
    })
  })
  return result
})

const headerText = computed(() => {
  if (props.phase === 'select-start') return 'Wähle dein Startfeld:'
  return 'Wähle dein nächstes Feld:'
})

const currentField = computed(() => {
  if (props.currentPosition === null) return null
  return fieldMap.value.get(props.currentPosition) || null
})

const selectablePositions = computed(() => {
  if (props.phase === 'select-start') {
    return new Set(props.fields.filter((f) => f.type === 'START').map((f) => f.position))
  }
  if (currentField.value) {
    return new Set(currentField.value.nextFields || [])
  }
  return new Set()
})

function isSelectable(field) {
  return selectablePositions.value.has(field.position)
}

function fieldIcon(field) {
  switch (field.type) {
    case 'START':
      return '💎'
    case 'HEAL':
      return '🧪'
    case 'FIGHT':
      return '💀'
    case 'BOSS':
      return '👑'
    default:
      return ''
  }
}

function fieldFill(field) {
  if (field.position === props.currentPosition) return '#4f8ef7'
  if (isSelectable(field)) return '#e8f0fe'
  switch (field.type) {
    case 'START':
      return '#dbeafe'
    case 'HEAL':
      return '#dcfce7'
    case 'FIGHT':
      return '#fee2e2'
    case 'BOSS':
      return '#fef3c7'
    default:
      return '#f5f5f5'
  }
}

function fieldStroke(field) {
  if (field.position === props.currentPosition) return '#4f8ef7'
  if (isSelectable(field)) return '#4f8ef7'
  return '#ccc'
}

function onFieldClick(field) {
  if (!isSelectable(field)) return
  emit('fieldSelected', field)
}
</script>

<style scoped>
.run-map-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 0.75rem;
}

.run-map-header {
  font-size: 1rem;
  font-weight: 600;
  flex-shrink: 0;
}

.run-map-hint {
  margin: 0;
}

.run-map-legend {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.run-map-canvas-wrapper {
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  border: 1px solid var(--color-border);
  border-radius: 0.75rem;
  background: var(--color-background-soft);
  min-height: 0;
}

.run-map-svg {
  display: block;
  width: 120rem;
  height: auto;    /* ← Browser berechnet Höhe aus viewBox */
}

.field-pulse {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}
</style>
