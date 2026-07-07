<template>
  <div class="run-map-view">
    <!-- Header nur am Anfang -->
    <div class="run-map-header" v-if="phase === 'select-start'">
      <p class="run-map-hint">Wähle dein Startfeld:</p>
    </div>

    <!-- Legende danach -->
    <div class="run-map-legend" v-else>
      <span class="legend-item"><img :src="start_icon" class="legend-icon" /> Start</span>
      <span class="legend-item"><img :src="heal_icon" class="legend-icon" /> Heilung</span>
      <span class="legend-item"><img :src="enemy_icon" class="legend-icon" /> Kampf</span>
      <span class="legend-item"><img :src="boss_icon" class="legend-icon" /> Boss</span>
      <span class="legend-item"><span class="legend-normal-swatch"></span> Normal</span>
    </div>

    <!-- Map Canvas -->
    <div
      class="run-map-canvas-wrapper"
      ref="canvasRef"
      :class="{ dragging: isDragging }"
      @mousedown="onDragStart"
      @mousemove="onDragMove"
      @mouseup="onDragEnd"
      @mouseleave="onDragEnd"
    >
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
          :class="{
            'field-current': field.position === currentPosition,
            'field-selectable': isSelectable(field),
          }"
          @click="onFieldClick(field)"
          style="cursor: pointer; image-rendering: pixelated"
        >
          <!-- Bild -->
          <circle
            v-if="field.position === currentPosition || isSelectable(field)"
            r="2.8"
            :class="{
              'field-glow-current': field.position === currentPosition,
              'field-glow-selectable': isSelectable(field) && field.position !== currentPosition,
            }"
          />
          <image
            :href="fieldImage(field)"
            x="-2.5"
            y="-2.5"
            width="5"
            height="5"
            class="field-image"
          />

          <!-- Icon -->
          <image
            :href="fieldIcon(field)"
            x="-1.25"
            y="-1.25"
            width="2.5"
            height="2.5"
            style="pointer-events: none"
          />
        </g>
      </svg>

      <p v-else class="placeholder">Map wird geladen...</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import forest_field from '@/assets/gui/field_basic.png'
import boss_field from '@/assets/gui/field_boss.png'
import boss_icon from '@/assets/gui/boss_icon.png'
import enemy_icon from '@/assets/gui/enemy_icon.png'
import heal_icon from '@/assets/gui/heal_icon.png'
import start_icon from '@/assets/gui/start_icon.png'

const props = defineProps({
  fields: { type: Array, default: () => [] },
  currentPosition: { type: Number, default: null },
  phase: { type: String, default: 'select-start' }, // 'select-start' | 'select-next'
})

const emit = defineEmits(['fieldSelected'])

const CELL_W = 8
const CELL_H = 8 // ← größer damit mehr vertikaler Abstand
const PADDING = 5

const canvasRef = ref(null)
const isDragging = ref(false)
let dragStartX = 0
let scrollStartX = 0
let dragMoved = false

function onDragStart(event) {
  isDragging.value = true
  dragMoved = false
  dragStartX = event.pageX
  scrollStartX = canvasRef.value.scrollLeft
}

function onDragMove(event) {
  if (!isDragging.value) return
  const delta = event.pageX - dragStartX
  if (Math.abs(delta) > 5) dragMoved = true
  canvasRef.value.scrollLeft = scrollStartX - delta
}

function onDragEnd() {
  isDragging.value = false
}

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
      return start_icon
    case 'HEAL':
      return heal_icon
    case 'FIGHT':
      return enemy_icon
    case 'BOSS':
      return boss_icon
    default:
      return ''
  }
}

function fieldImage(field) {
  switch (field.type) {
    case 'BOSS':
      return boss_field
    default:
      return forest_field
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
  if (dragMoved) return // ← neu: war eigentlich ein Drag, keine Auswahl auslösen
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

.legend-icon {
  width: 1.2rem;
  height: 1.2rem;
  image-rendering: pixelated;
}

.legend-normal-swatch {
  width: 1.2rem;
  height: 1.2rem;
  background: var(--color-background-mute);
  border: 1px solid var(--color-border);
  border-radius: 0.2rem;
}

.run-map-canvas-wrapper {
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  border: 1px solid #ddd;
  border-radius: 0.75rem;
  background: #f8f8f8;
  min-height: 0;
  cursor: grab;
  user-select: none;
  scrollbar-width: none;         /* Firefox */
}

.run-map-canvas-wrapper::-webkit-scrollbar {
  display: none;                 /* Chrome/Safari/Edge */
}

.run-map-canvas-wrapper.dragging {
  cursor: grabbing;
}

.run-map-svg {
  display: block;
  width: 120rem;
  height: auto; /* ← Browser berechnet Höhe aus viewBox */
}

.field-glow-current {
  fill: rgba(59, 130, 246, 0.45);
}

.field-glow-selectable {
  fill: rgba(59, 130, 246, 0.75);
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
