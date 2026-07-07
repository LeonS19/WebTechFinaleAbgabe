<template>
  <div class="combat-view">
    <div class="combat-arena">
      <div class="combat-top-bar">
        <button class="end-run-btn" @click="onEndRunClick">Run beenden</button>
        <button class="end-turn-btn" :disabled="!!activeCard || endingTurn" @click="onEndTurnClick">
          {{ endingTurn ? 'Wird beendet...' : 'Runde beenden' }}
        </button>
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
      <div class="deck-counter">
        <h2>{{ deckCount }}</h2>
      </div>
    </div>

    <CardPlayOverlay
      v-if="activeCard"
      :card="activeCard"
      :feedback="answerFeedback"
      @confirm="onConfirm"
      @close="onOverlayClose"
    />
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount, watch } from 'vue'
import HandCard from './HandCard.vue'
import CardPlayOverlay from './CardPlayOverlay.vue'

const slimeGifs = import.meta.glob('../../assets/characters/slime/*.gif', {
  eager: true,
  import: 'default',
})
const bossGifs = import.meta.glob('../../assets/characters/boss/*.gif', {
  eager: true,
  import: 'default',
})

const playerGifs = import.meta.glob('../../assets/characters/player/*.gif', {
  eager: true,
  import: 'default',
})
const enemyVariant = ref(0)

const props = defineProps({
  enemy: Object,
  hand: { type: Array, default: () => [] },
  deckCount: { type: Number, default: 0 },
  playerHp: { type: Number, default: 100 },
  playerMaxHp: { type: Number, default: 100 },
  enemyHp: { type: Number, default: 100 },
  // Dauer der GIFs in ms = frameCount * 150ms Frame-Delay
  playerAttackDuration: { type: Number, default: 900 }, // 6 Frames
  playerHurtDuration: { type: Number, default: 600 }, // 4 Frames
  enemyAttackDuration: { type: Number, default: 600 }, // 4 Frames
  enemyHurtDuration: { type: Number, default: 900 }, // 6 Frames
  // Kleine Pause NACH der vollständigen Attack-Animation, bevor die
  // Hurt-Animation der Gegenseite einsetzt (statt Überlappung während des Angriffs).
  reactionGap: { type: Number, default: 100 },
  characterId: { type: Number, default: 1 },
  playerDeathDuration: { type: Number, default: 1200 }, // 8 Frames × 150ms
  slimeDeathDuration: { type: Number, default: 450 }, // 3 Frames × 150ms
  bossDeathDuration: { type: Number, default: 900 }, // 6 Frames × 150ms
})

// Neue Zufallsvariante, sobald ein neuer Gegner ankommt (= neuer Kampf startet)
watch(
  () => props.enemy,
  (newEnemy) => {
    if (!newEnemy) return
    const isBoss = newEnemy.type === 'BOSS'
    const idleVariants = findVariants(
      isBoss ? bossGifs : slimeGifs,
      isBoss ? 'boss' : 'slime',
      'idle',
    )
    enemyVariant.value =
      idleVariants.length > 0 ? Math.floor(Math.random() * idleVariants.length) : 0
  },
  { immediate: true },
)

const emit = defineEmits(['cardPlayed', 'endTurn', 'runAbandoned'])
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

const gifSources = computed(() => {
  const isBoss = props.enemy?.type === 'BOSS'
  const enemyGifs = isBoss ? bossGifs : slimeGifs
  const enemyPrefix = isBoss ? 'boss' : 'slime'
  const v = enemyVariant.value

  const idleVariants = findVariants(enemyGifs, enemyPrefix, 'idle')
  const attackVariants = findVariants(enemyGifs, enemyPrefix, 'attack')
  const hurtVariants = findVariants(enemyGifs, enemyPrefix, 'hurt')
  const deathVariants = findVariants(enemyGifs, enemyPrefix, 'death')

  return {
    player: {
      idle: getPlayerGif(props.characterId, 'idle'),
      attack: getPlayerGif(props.characterId, 'attack'),
      hurt: getPlayerGif(props.characterId, 'hurt'),
      death: getPlayerDeathGif(props.characterId),
    },
    enemy: {
      idle: idleVariants[v % idleVariants.length],
      attack: attackVariants[v % attackVariants.length],
      hurt: hurtVariants[0],
      death: deathVariants[0] ?? hurtVariants[0], // Fallback, falls kein death.gif existiert (Schleim)
    },
  }
})

const playerSpriteSrc = computed(
  () => `${gifSources.value.player[playerAnim.value]}?r=${playerAnimKey.value}`,
)
const enemySpriteSrc = computed(
  () => `${gifSources.value.enemy[enemyAnim.value]}?r=${enemyAnimKey.value}`,
)

function getPlayerGif(characterId, state) {
  const key = Object.keys(playerGifs).find((k) => k.endsWith(`player_${state}_${characterId}.gif`))
  return playerGifs[key]
}

function getPlayerDeathGif(characterId) {
  const perCharacter = Object.keys(playerGifs).find((k) =>
    k.endsWith(`player_death_${characterId}.gif`),
  )
  if (perCharacter) return playerGifs[perCharacter]

  const generic = Object.keys(playerGifs).find((k) => k.endsWith('player_death.gif'))
  if (generic) return playerGifs[generic]

  // Kein eigenes Death-Sprite vorhanden -> letzter Hurt-Frame als Fallback
  return getPlayerGif(characterId, 'hurt')
}

// Findet alle Varianten eines Zustands (z.B. "idle") — nummerierte Dateien
// (idle_1, idle_2, ...) werden alle gefunden; gibt's keine Nummer (z.B. death.gif),
// wird die einzelne Datei als einzige "Variante" zurückgegeben.
function findVariants(gifs, prefix, state) {
  const numbered = Object.keys(gifs)
    .filter((k) => new RegExp(`${prefix}_${state}_\\d+\\.gif$`).test(k))
    .sort()
  if (numbered.length > 0) return numbered.map((k) => gifs[k])

  const single = Object.keys(gifs).find((k) => k.endsWith(`${prefix}_${state}.gif`))
  return single ? [gifs[single]] : []
}

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

function playDeathAnimation(target) {
  return new Promise((resolve) => {
    if (target === 'player') {
      playerAnim.value = 'death'
      setTimeout(resolve, props.playerDeathDuration)
    } else {
      const isBoss = props.enemy?.type === 'BOSS'
      enemyAnim.value = 'death'
      setTimeout(resolve, isBoss ? props.bossDeathDuration : props.slimeDeathDuration)
    }
  })
}

function onEndTurnClick() {
  if (activeCard.value || endingTurn.value) return
  endingTurn.value = true
  emit('endTurn')
}

function onEndRunClick() {
  const confirmed = window.confirm(
    'Run wirklich beenden? Das kann nicht rückgängig gemacht werden.',
  )
  if (!confirmed) return
  emit('runAbandoned')
}

// Von RunView aufgerufen, sobald die endTurn-Mutation (egal ob erfolgreich oder
// fehlgeschlagen) abgeschlossen ist, damit der Button wieder nutzbar wird.
function finishEndTurn() {
  endingTurn.value = false
}

defineExpose({ playCombatAnimation, resolveAnswer, finishEndTurn, playDeathAnimation })

onBeforeUnmount(() => {
  clearTimeout(playerTimer)
  clearTimeout(enemyTimer)
  clearTimeout(reactionTimer)
  clearTimeout(autoCloseTimer)
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
let pendingResolve = null
let autoCloseTimer = null

function resolveAnswer({ correct, correctAnswer }) {
  answerFeedback.value = { correct, correctAnswer }

  return new Promise((resolve) => {
    pendingResolve = resolve

    if (correct) {
      // Richtig beantwortet: nach kurzer Zeit automatisch schließen
      autoCloseTimer = setTimeout(() => closeFeedback(), 900)
    }
    // Falsch beantwortet: kein Auto-Timer — wartet auf manuellen Klick auf ✕
  })
}

function closeFeedback() {
  clearTimeout(autoCloseTimer)
  activeCard.value = null
  answerFeedback.value = null
  const resolve = pendingResolve
  pendingResolve = null
  if (resolve) resolve()
}

function onOverlayClose() {
  if (answerFeedback.value) {
    // Feedback wird gerade angezeigt (richtig oder falsch) -> manuelles Schließen
    closeFeedback()
  } else {
    // Noch keine Antwort abgeschickt -> normales Abbrechen
    activeCard.value = null
  }
}
</script>

<style scoped>
.combat-view {
  display: flex;
  flex-direction: column;
  position: relative;
  background-image: url('@/assets/gui/background_enemy.png');
  background-size: cover;
  background-position: center 20%;
}

.combat-arena {
  flex: 0 0 45%;
  min-height: 0;
  overflow: hidden; /* ← neu: verhindert das "Auslaufen" des Inhalts */
  display: flex;
  flex-direction: column;
  padding: 1rem 2rem 0 2rem;
  gap: 0.5rem;
}

.combat-hand {
  flex: 0 0 55%;
  min-height: 0;
  overflow: hidden;
  margin: 0 1.5rem; /* ← neu: Abstand links/rechts */
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background-image: url('@/assets/gui/table.png');
  background-size: cover;
  image-rendering: pixelated;
  border-radius: 1rem;
  padding: 0 2rem;
}

.combat-top-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.combat-info {
  color: white;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.4rem;
  width: 14rem;
  flex-shrink: 0;
}

.combat-name {
  font-size: 0.9rem;
  font-weight: 600;
}

.health-bar-wrapper {
  width: 100%;
  height: 2rem;
  background: var(--color-background-mute);
  overflow: hidden;
  position: relative;
}

.health-bar {
  height: 100%;
  background: #4ade80;
  border-radius: 1rem;
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
  color: white;
  padding: 0.4rem 0.9rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: var(--color-background-mute);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.end-turn-btn:hover {
  background: #26b8dc;
  color: white;
  border-color: white;
}

.end-run-btn {
  padding: 0.4rem 0.9rem;
  border-radius: 0.5rem;
  border: 1px solid var(--color-border);
  background: var(--color-background-mute);
  color: white;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.end-run-btn:hover {
  background: #dc2626;
  color: white;
  border-color: #dc2626;
}

.deck-counter {
  position: absolute;
  right: -10rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background-image: url('@/assets/gui/deck_stapel.png');
  background-size: cover;
  image-rendering: pixelated;
  height: 30%;
  width: 30%;
  font-size: 0.9rem;
  font-weight: 600;
}

.deck-counter h2 {
  font-size: 4rem;
  margin: 0;
}

.combat-sprites-row {
  flex: 1;
  min-height: 0;
  position: relative; /* ← neu, wird der Bezugsrahmen für die Sprites */
}

.combat-sprite {
  position: absolute; /* ← neu: raus aus dem normalen Fluss */
  bottom: 0;
}

.player-sprite {
  left: 8%; /* Wert nach Geschmack anpassen */
}

.enemy-sprite {
  right: 5%; /* Wert nach Geschmack anpassen */
}

.combat-sprite img {
  display: block;
  width: auto;
  image-rendering: pixelated;
  object-fit: contain;
}

.player-sprite img {
  height: 7rem;
}

.enemy-sprite img {
  height: 25rem; /* jetzt kannst du das frei größer/kleiner machen */
}

.hand-cards {
  padding-bottom: 1rem;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  position: relative;
  height: 100%;
  width: 100%;
}
</style>
