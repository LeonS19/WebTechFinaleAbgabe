<template>
  <div class="combat-view" :class="{ 'combat-view--boss': isBossFight }">
    <div class="combat-arena">
      <div class="combat-top-bar">
        <button class="end-run-btn" @click="onEndRunClick">Run beenden</button>
        <button class="end-turn-btn" :disabled="!!activeCard || endingTurn" @click="onEndTurnClick">
          {{ endingTurn ? 'Wird beendet...' : 'Runde beenden' }}
        </button>
      </div>

      <!-- Trennlinie -->
      <!-- <div class="combat-divider"></div> -->

      <transition name="perfect-banner">
        <div v-if="perfectRoundText" class="perfect-round-banner">{{ perfectRoundText }}</div>
      </transition>

      <!-- Namen + Healthbars mittig -->
      <div class="combat-top-row">
        <div class="combat-info">
          <span class="combat-name">{{ username || 'Du' }} <span class="combat-level">Lvl. {{ playerLevel }}</span></span>
          <div class="health-bar-wrapper">
            <div class="health-bar" :style="{ width: playerHealthPercent + '%' }"></div>
            <span class="health-label">{{ playerHp }} / {{ playerMaxHp }}</span>
          </div>
        </div>

        <div class="combat-top-spacer"></div>

        <div class="combat-info">
          <span class="combat-name">{{ enemy?.name }} <span class="combat-level">{{ enemy?.type === 'BOSS' ? 'BOSS' : `Lvl. ${enemy?.level}` }}</span></span>
          <div class="health-bar-wrapper">
            <div class="health-bar enemy" :style="{ width: enemyHealthPercent + '%' }"></div>
            <span class="health-label">{{ enemyHp }} / {{ enemy?.baseHealth }}</span>
          </div>
        </div>
      </div>

      <!-- Untere Reihe: Sprites -->
      <div class="combat-sprites-row">
        <div class="combat-sprite player-sprite" :class="{ 'sprite-defeated': playerDefeated }">
          <img :src="playerSpriteSrc" alt="Player" />
          <transition-group name="damage-pop" tag="div" class="damage-popup-layer">
            <span
              v-for="popup in playerDamagePopups"
              :key="popup.id"
              class="damage-popup"
            >-{{ popup.amount }}</span>
            <span
              v-for="popup in playerHealPopups"
              :key="'heal-' + popup.id"
              class="damage-popup heal-popup"
            >+{{ popup.amount }}</span>
          </transition-group>
        </div>

        <div class="combat-sprite enemy-sprite" :class="{ 'sprite-defeated': enemyDefeated }">
          <img :src="enemySpriteSrc" alt="Enemy" />
          <transition-group name="damage-pop" tag="div" class="damage-popup-layer">
            <span
              v-for="popup in enemyDamagePopups"
              :key="popup.id"
              class="damage-popup"
            >-{{ popup.amount }}</span>
          </transition-group>
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
        <img src="@/assets/gui/deck_stapel_new.png" alt="" class="deck-counter-bg" />
        <h2>{{ deckCount }}</h2>
        <span class="counter-tooltip">Dein Deck</span>
      </div>
      <div class="discard-counter">
        <img src="@/assets/gui/ablage_deck.png" alt="" class="discard-counter-bg" />
        <h2>{{ discardCount }}</h2>
        <span class="counter-tooltip">Dein Ablagestapel</span>
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
  combatId: { type: String, default: null },
  hand: { type: Array, default: () => [] },
  deckCount: { type: Number, default: 0 },
  discardCount: { type: Number, default: 0 },
  playerHp: { type: Number, default: 100 },
  playerMaxHp: { type: Number, default: 100 },
  enemyHp: { type: Number, default: 100 },
  playerLevel: { type: Number, default: 1 },
  username: { type: String, default: '' },
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

// Nach der Todesanimation ausgeblendet — GIFs loopen im Browser automatisch, ohne
// das würde die letzte Death-Animation nach ihrem letzten Frame wieder von vorn
// beginnen und der Gegner/Spieler würde optisch "wiederauferstehen".
const enemyDefeated = ref(false)
const playerDefeated = ref(false)

// Neue Zufallsvariante, sobald ein neuer Gegner ankommt (= neuer Kampf startet).
// Wichtig: NICHT auf props.enemy selbst hören — RunView baut bei jeder Antwort ein
// neues enemy-Objekt (gleicher Inhalt, neue Referenz), wodurch der Watch sonst nach
// jeder Interaktion erneut feuern und die Variante mitten im Kampf wechseln würde.
// combatId bleibt dagegen für die gesamte Dauer eines Kampfes stabil.
watch(
  () => props.combatId,
  () => {
    // Neuer Kampf beginnt — Sprites wieder einblenden, falls der vorherige Kampf
    // mit einer Todesanimation endete.
    enemyDefeated.value = false
    playerDefeated.value = false

    const newEnemy = props.enemy
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

const isBossFight = computed(() => props.enemy?.type === 'BOSS')

// ---- Sprite Animation State ----
const playerAnim = ref('idle') // 'idle' | 'attack' | 'hurt'
const enemyAnim = ref('idle')
const playerAnimKey = ref(0) // Cache-Buster, damit das GIF bei jedem Trigger von vorne startet
const enemyAnimKey = ref(0)

let playerTimer = null
let enemyTimer = null
let reactionTimer = null

// ---- Fliegende Schadenszahlen ----
// Jede Zahl ist ein kurzlebiges Objekt { id, amount }, das für die Dauer der
// CSS-Transition (siehe .damage-pop-* Klassen) im Array lebt und sich danach
// selbst wieder entfernt.
const playerDamagePopups = ref([])
const enemyDamagePopups = ref([])
const playerHealPopups = ref([])
let popupCounter = 0

function spawnDamageNumber(target, amount) {
  if (!amount) return
  const id = ++popupCounter
  const list = target === 'player' ? playerDamagePopups : enemyDamagePopups
  list.value = [...list.value, { id, amount }]
  setTimeout(() => {
    list.value = list.value.filter((p) => p.id !== id)
  }, 900)
}

// Wird von RunView aufgerufen, sobald eine Heilung erkannt wurde (z.B. Perfekt-Runde) —
// eigene grüne Zahl, unabhängig von der Angriffs-Timing-Logik oben.
function spawnHealNumber(amount) {
  if (!amount || amount <= 0) return
  const id = ++popupCounter
  playerHealPopups.value = [...playerHealPopups.value, { id, amount }]
  setTimeout(() => {
    playerHealPopups.value = playerHealPopups.value.filter((p) => p.id !== id)
  }, 900)
}

// Großer Text mittig, wenn eine Runde perfekt gespielt wurde.
const perfectRoundText = ref(null)
const PERFECT_ROUND_PHRASES = ['Perfekt!', 'Wow!', 'Unglaublich!', 'Makellos!', 'Stark!']
let perfectRoundTimer = null

function showPerfectRoundBanner() {
  clearTimeout(perfectRoundTimer)
  perfectRoundText.value =
    PERFECT_ROUND_PHRASES[Math.floor(Math.random() * PERFECT_ROUND_PHRASES.length)]
  perfectRoundTimer = setTimeout(() => {
    perfectRoundText.value = null
  }, 1400)
}

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
      hurt: hurtVariants[v % hurtVariants.length],
      death: deathVariants.length > 0 ? deathVariants[v % deathVariants.length] : hurtVariants[v % hurtVariants.length], // Fallback, falls kein death.gif existiert (Schleim)
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
 * damageAmount       → Schaden, der beim Treffer als fliegende Zahl angezeigt wird
 */
function playCombatAnimation(correct, damageAmount = 0) {
  clearTimeout(reactionTimer)
  return new Promise((resolve) => {
    if (correct) {
      setAnim('player', 'attack', props.playerAttackDuration)
      const waitForAttackEnd = props.playerAttackDuration + props.reactionGap
      reactionTimer = setTimeout(() => {
        setAnim('enemy', 'hurt', props.enemyHurtDuration)
        spawnDamageNumber('enemy', damageAmount)
        resolve()
      }, waitForAttackEnd)
    } else {
      setAnim('enemy', 'attack', props.enemyAttackDuration)
      const waitForAttackEnd = props.enemyAttackDuration + props.reactionGap
      reactionTimer = setTimeout(() => {
        setAnim('player', 'hurt', props.playerHurtDuration)
        spawnDamageNumber('player', damageAmount)
        resolve()
      }, waitForAttackEnd)
    }
  })
}

function playDeathAnimation(target) {
  return new Promise((resolve) => {
    if (target === 'player') {
      playerAnim.value = 'death'
      setTimeout(() => {
        playerDefeated.value = true
        resolve()
      }, props.playerDeathDuration)
    } else {
      const isBoss = props.enemy?.type === 'BOSS'
      enemyAnim.value = 'death'
      setTimeout(() => {
        enemyDefeated.value = true
        resolve()
      }, isBoss ? props.bossDeathDuration : props.slimeDeathDuration)
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

defineExpose({ playCombatAnimation, resolveAnswer, finishEndTurn, playDeathAnimation, spawnHealNumber, showPerfectRoundBanner })

onBeforeUnmount(() => {
  clearTimeout(playerTimer)
  clearTimeout(enemyTimer)
  clearTimeout(reactionTimer)
  clearTimeout(autoCloseTimer)
  clearTimeout(perfectRoundTimer)
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

.combat-view--boss {
  background-image: url('@/assets/gui/background_boss.png');
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

.combat-level {
  font-size: 0.8rem;
  font-weight: 500;
  opacity: 0.7;
  margin-left: 0.35rem;
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
  bottom: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 450px;
  width: 220px;
  font-size: 0.9rem;
  font-weight: 600;
}

.deck-counter-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: bottom right;
  image-rendering: -moz-crisp-edges;
  image-rendering: -webkit-crisp-edges;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.deck-counter h2 {
  position: relative;
  font-size: 4rem;
  margin: 0;
  transform: translate(10px, 50px);
}

/* Ablage-Stapel — gespiegelt auf der linken Seite, gleiches Prinzip wie der Deck-Counter */
.discard-counter {
  position: absolute;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 550px;
  width: 269px;
  font-size: 0.9rem;
  font-weight: 600;
}

.discard-counter-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: bottom left;
  image-rendering: -moz-crisp-edges;
  image-rendering: -webkit-crisp-edges;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

.discard-counter h2 {
  position: relative;
  font-size: 4rem;
  margin: 0;
  transform: translate(10px, 100px);
}

.counter-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translate(-50%, 8px);
  margin-bottom: 0.5rem;
  padding: 0.4rem 0.9rem;
  background: rgba(20, 15, 10, 0.92);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  border-radius: 0.4rem;
  border: 1px solid rgba(255, 255, 255, 0.15);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease, transform 0.15s ease;
  z-index: 30;
}

.deck-counter:hover .counter-tooltip,
.discard-counter:hover .counter-tooltip {
  opacity: 1;
  transform: translate(-50%, 0);
}

.combat-sprites-row {
  flex: 1;
  min-height: 0;
  position: relative; /* ← neu, wird der Bezugsrahmen für die Sprites */
}

.combat-sprite {
  position: absolute; /* ← neu: raus aus dem normalen Fluss */
  bottom: 0;
  opacity: 1;
  transition: opacity 0.4s ease;
}

.sprite-defeated {
  opacity: 0;
}

.damage-popup-layer {
  position: absolute;
  top: 0;
  left: 50%;
  width: 0;
  height: 0;
  pointer-events: none;
}

/* Enemy-Sprite ist deutlich größer (25rem vs. 7rem) — Layer tiefer ansetzen,
   damit die Zahl nicht weit über dem Kopf des Gegners startet. */
.enemy-sprite .damage-popup-layer {
  top: 60%;
}

.damage-popup {
  position: absolute;
  left: 0;
  top: 0;
  transform: translate(-50%, 0);
  font-family: inherit;
  font-weight: 800;
  font-size: 1.6rem;
  color: #ff4d4d;
  text-shadow:
    -1px -1px 0 #2c0000,
    1px -1px 0 #2c0000,
    -1px 1px 0 #2c0000,
    1px 1px 0 #2c0000;
  white-space: nowrap;
}

.heal-popup {
  color: #4ade80;
  text-shadow:
    -1px -1px 0 #0a3d1f,
    1px -1px 0 #0a3d1f,
    -1px 1px 0 #0a3d1f,
    1px 1px 0 #0a3d1f;
}

.perfect-round-banner {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 20;
  font-family: inherit;
  font-weight: 900;
  font-size: 3rem;
  letter-spacing: 0.05em;
  color: #ffd93d;
  text-shadow:
    -2px -2px 0 #7a4a00,
    2px -2px 0 #7a4a00,
    -2px 2px 0 #7a4a00,
    2px 2px 0 #7a4a00,
    0 0 20px rgba(255, 217, 61, 0.7);
  pointer-events: none;
  white-space: nowrap;
}

.perfect-banner-enter-active {
  animation: perfect-banner-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.perfect-banner-leave-active {
  animation: perfect-banner-out 0.35s ease-in forwards;
}

@keyframes perfect-banner-in {
  0% {
    transform: translate(-50%, -50%) scale(0.3) rotate(-6deg);
    opacity: 0;
  }
  60% {
    transform: translate(-50%, -50%) scale(1.15) rotate(2deg);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1) rotate(0deg);
    opacity: 1;
  }
}

@keyframes perfect-banner-out {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(0.7);
    opacity: 0;
  }
}

/* Popup ploppt von unten hoch, "fliegt" zum Ziel (nach oben Richtung Sprite-Kopf)
   und verblasst am Ende — via Transition-Group-Klassen von Vue automatisch verwaltet. */
.damage-pop-enter-active {
  animation: damage-fly 0.9s ease-out forwards;
}

.damage-pop-leave-active {
  display: none; /* Popup entfernt sich selbst nach der Animation, kein Leave-Übergang nötig */
}

@keyframes damage-fly {
  0% {
    transform: translate(-50%, 30px) scale(0.6);
    opacity: 0;
  }
  25% {
    transform: translate(-50%, -10px) scale(1.15);
    opacity: 1;
  }
  70% {
    transform: translate(-50%, -70px) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -110px) scale(0.9);
    opacity: 0;
  }
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