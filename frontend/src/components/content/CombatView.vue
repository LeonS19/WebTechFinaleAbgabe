<template>
  <div class="combat-view">
    <div class="combat-arena">
      <!-- Deck Counter + Rundenende ganz oben rechts -->
      <div class="combat-top-bar">
        <button
          class="end-turn-btn"
          :disabled="!!activeCard || endingTurn"
          @click="onEndTurnClick"
        >
          {{ endingTurn ? 'Wird beendet...' : 'Runde beenden' }}
        </button>
        <div class="deck-counter">
          🃏 <span>{{ deckCount }}</span>
        </div>
      </div>

      <!-- Trennlinie -->
      <!-- <div class="combat-divider"></div> -->

      <!-- Namen + Healthbars mittig -->
      <div class="combat-top-row">
        <div class="combat-info">
          <span class="combat-name">Du</span>
          <div class="health-bar-wrapper">
            <div class="health-bar" :style="{ width: playerHealthPercent + '%' }"></div>
            <span class="health-label">{{ playerHp }} / {{ playerMaxHp }}</span>
          </div>
        </div>

        <div class="combat-top-spacer"></div>

        <div class="combat-info">
          <span class="combat-name">{{ enemy?.name }}</span>
          <div class="health-bar-wrapper">
            <div class="health-bar enemy" :style="{ width: enemyHealthPercent + '%' }"></div>
            <span class="health-label">{{ enemyHp }} / {{ enemy?.baseHealth }}</span>
          </div>
        </div>
      </div>

      <!-- Untere Reihe: Sprites -->
      <div class="combat-sprites-row">
        <div class="combat-sprite player-sprite">
          <img :src="playerSpriteSrc" alt="Player" />
        </div>

        <div class="combat-vs">VS</div>

        <div class="combat-sprite enemy-sprite">
          <img :src="enemySpriteSrc" alt="Enemy" />
        </div>
      </div>
    </div>

    <div class="combat-hand">
      <div class="hand-cards">
        <HandCard
          v-for="(card, index) in hand"
          :key="card.id"
          :card="card"
          :index="index"
          :total="hand.length"
          :isNew="card._isNew"
          @play="onPlayCard"
        />
      </div>
    </div>

    <CardPlayOverlay
      v-if="activeCard"
      :card="activeCard"
      :feedback="answerFeedback"
      @confirm="onConfirm"
      @close="activeCard = null"
    />
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import HandCard from './HandCard.vue'
import CardPlayOverlay from './CardPlayOverlay.vue'

import playerIdleGif from '../../assets/characters/player/player_idle.gif'
import playerAttackGif from '../../assets/characters/player/player_attack.gif'
import playerHurtGif from '../../assets/characters/player/player_hurt.gif'
import slimeIdleGif from '../../assets/characters/slime/slime_idle.gif'
import slimeAttackGif from '../../assets/characters/slime/slime_attack.gif'
import slimeHurtGif from '../../assets/characters/slime/slime_hurt.gif'

const props = defineProps({
  enemy: Object,
  hand: { type: Array, default: () => [] },
  deckCount: { type: Number, default: 0 },
  playerHp: { type: Number, default: 100 },
  playerMaxHp: { type: Number, default: 100 },
  enemyHp: { type: Number, default: 100 },
  // Dauer der GIFs in ms = frameCount * 150ms Frame-Delay
  playerAttackDuration: { type: Number, default: 900 }, // 6 Frames
  playerHurtDuration: { type: Number, default: 600 },    // 4 Frames
  enemyAttackDuration: { type: Number, default: 600 },   // 4 Frames
  enemyHurtDuration: { type: Number, default: 900 },     // 6 Frames
  // Kleine Pause NACH der vollständigen Attack-Animation, bevor die
  // Hurt-Animation der Gegenseite einsetzt (statt Überlappung während des Angriffs).
  reactionGap: { type: Number, default: 100 },
})

const emit = defineEmits(['cardPlayed', 'endTurn'])
const activeCard = ref(null)
// { correct: Boolean, correctAnswer: String } | null — an CardPlayOverlay durchgereicht.
// Wird von RunView über resolveAnswer() gesetzt, sobald die answerCard-Mutation antwortet.
const answerFeedback = ref(null)
// Verhindert Doppel-Klicks auf "Runde beenden", während RunView die endTurn-Mutation ausführt.
const endingTurn = ref(false)

const playerHealthPercent = computed(() =>
  Math.max(0, Math.min(100, (props.playerHp / props.playerMaxHp) * 100)),
)

const enemyHealthPercent = computed(() =>
  Math.max(0, Math.min(100, (props.enemyHp / (props.enemy?.baseHealth || 1)) * 100)),
)

// ---- Sprite Animation State ----
const playerAnim = ref('idle') // 'idle' | 'attack' | 'hurt'
const enemyAnim = ref('idle')
const playerAnimKey = ref(0) // Cache-Buster, damit das GIF bei jedem Trigger von vorne startet
const enemyAnimKey = ref(0)

let playerTimer = null
let enemyTimer = null
let reactionTimer = null

const gifSources = {
  player: { idle: playerIdleGif, attack: playerAttackGif, hurt: playerHurtGif },
  enemy: { idle: slimeIdleGif, attack: slimeAttackGif, hurt: slimeHurtGif },
}

const playerSpriteSrc = computed(
  () => `${gifSources.player[playerAnim.value]}?r=${playerAnimKey.value}`,
)
const enemySpriteSrc = computed(
  () => `${gifSources.enemy[enemyAnim.value]}?r=${enemyAnimKey.value}`,
)

function setAnim(target, anim, duration) {
  if (target === 'player') {
    clearTimeout(playerTimer)
    playerAnimKey.value++
    playerAnim.value = anim
    playerTimer = setTimeout(() => {
      playerAnim.value = 'idle'
    }, duration)
  } else {
    clearTimeout(enemyTimer)
    enemyAnimKey.value++
    enemyAnim.value = anim
    enemyTimer = setTimeout(() => {
      enemyAnim.value = 'idle'
    }, duration)
  }
}

/**
 * Spielt die Angriffs-/Treffer-Animation für eine Kampfrunde ab.
 * correct === true  → Spieler greift an, Gegner wird getroffen
 * correct === false → Gegner greift an, Spieler wird getroffen
 */
function playCombatAnimation(correct) {
  clearTimeout(reactionTimer)
  return new Promise((resolve) => {
    if (correct) {
      setAnim('player', 'attack', props.playerAttackDuration)
      const waitForAttackEnd = props.playerAttackDuration + props.reactionGap
      reactionTimer = setTimeout(() => {
        setAnim('enemy', 'hurt', props.enemyHurtDuration)
        resolve()
      }, waitForAttackEnd)
    } else {
      setAnim('enemy', 'attack', props.enemyAttackDuration)
      const waitForAttackEnd = props.enemyAttackDuration + props.reactionGap
      reactionTimer = setTimeout(() => {
        setAnim('player', 'hurt', props.playerHurtDuration)
        resolve()
      }, waitForAttackEnd)
    }
  })
}

function onEndTurnClick() {
  if (activeCard.value || endingTurn.value) return
  endingTurn.value = true
  emit('endTurn')
}

// Von RunView aufgerufen, sobald die endTurn-Mutation (egal ob erfolgreich oder
// fehlgeschlagen) abgeschlossen ist, damit der Button wieder nutzbar wird.
function finishEndTurn() {
  endingTurn.value = false
}

defineExpose({ playCombatAnimation, resolveAnswer, finishEndTurn })

onBeforeUnmount(() => {
  clearTimeout(playerTimer)
  clearTimeout(enemyTimer)
  clearTimeout(reactionTimer)
})

function onPlayCard(card) {
  activeCard.value = card
  answerFeedback.value = null
}

function onConfirm(answer) {
  // Overlay bleibt offen — RunView ruft nach der answerCard-Mutation resolveAnswer()
  // auf, das zunächst das Feedback anzeigt und danach das Overlay selbst schließt.
  emit('cardPlayed', { card: activeCard.value, answer })
}

/**
 * Zeigt das Antwort-Feedback im Overlay an (richtig/falsch + korrekte Antwort),
 * wartet kurz damit der Nutzer es lesen kann, und schließt dann das Overlay.
 * Gibt ein Promise zurück, damit der Aufrufer (RunView) parallel dazu z.B. die
 * Sprite-Animation laufen lassen und auf beides zusammen warten kann.
 */
function resolveAnswer({ correct, correctAnswer }) {
  answerFeedback.value = { correct, correctAnswer }
  const readDuration = correct ? 900 : 1800 // falsche Antwort braucht mehr Lesezeit

  return new Promise((resolve) => {
    setTimeout(() => {
      activeCard.value = null
      answerFeedback.value = null
      resolve()
    }, readDuration)
  })
}
</script>

<style scoped>
.combat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.combat-arena {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--color-background-soft);
  border-bottom: 1px solid var(--color-border);
  padding: 1rem 2rem 0 2rem;
  gap: 0.5rem;
}

.combat-hand {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-background);
  padding: 0 2rem;
  overflow: hidden;
}

.combat-top-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 0 10rem 0 4rem;  /* ← rechts weniger padding */
}

.combat-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4rem;
  width: 14rem;
  flex-shrink: 0;
}

.combat-top-spacer {
  display: none;  /* ← nicht mehr nötig da gap */
}

.combat-name {
  font-size: 0.9rem;
  font-weight: 600;
}

.health-bar-wrapper {
  width: 100%;
  height: 1rem;
  background: var(--color-background-mute);
  border-radius: 0.5rem;
  overflow: hidden;
  position: relative;
}

.health-bar {
  height: 100%;
  background: #4ade80;
  border-radius: 0.5rem;
  transition: width 0.3s ease;
}

.health-bar.enemy {
  background: #f87171;
}

.health-label {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 0.65rem;
  font-weight: 700;
  color: #1a1a1a;
}

.combat-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border);
}

.end-turn-btn {
  padding: 0.4rem 0.9rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: var(--color-background-mute);
  color: var(--color-text);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.end-turn-btn:hover:not(:disabled) {
  background: var(--color-border);
}

.end-turn-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.deck-counter {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
}

.deck-counter span {
  font-size: 1.2rem;
}

.combat-sprites-row {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
}

.combat-sprite {
  line-height: 1;
}

.combat-sprite img {
  display: block;
  image-rendering: pixelated;
  object-fit: contain;
}

.player-sprite img {
  width: 8rem;
  height: 8rem;
}

.enemy-sprite img {
  width: 24rem;
  height: 24rem;
}

.combat-vs {
  font-size: 1.5rem;
  font-weight: 800;
  opacity: 0.3;
  margin-bottom: 2rem;
}

.hand-cards {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  position: relative;
  height: 100%;
  width: 100%;
}
</style>