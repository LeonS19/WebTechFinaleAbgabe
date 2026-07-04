<template>
  <div class="run-view">
    <RunMapView
      v-if="phase === 'map'"
      :fields="mapFields"
      :currentPosition="currentPosition"
      :phase="mapPhase"
      @fieldSelected="onFieldSelected"
    />

    <CombatView
      v-if="phase === 'combat'"
      ref="combatViewRef"
      :enemy="enemyForView"
      :hand="handForView"
      :deckCount="deckCount"
      :playerHp="playerHp"
      :playerMaxHp="playerMaxHp"
      :enemyHp="enemyHp"
      @cardPlayed="onCardPlayed"
    />

    <p v-if="actionError" class="run-error">{{ actionError }}</p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useQuery, useMutation } from '@vue/apollo-composable';
import { gql } from '@apollo/client/core';
import RunMapView from './RunMapView.vue';
import CombatView from './CombatView.vue';

const props = defineProps({
  studyGroupId: { type: String, required: true },
});

// ---- Map laden ----
const GET_MAP = gql`
  query GetMap {
    getMap {
      id
      name
      fields {
        id
        position
        x
        y
        type
        nextFields
        enemies {
          id
          name
          type
          baseHealth
          baseDamage
        }
      }
    }
  }
`;

const { result: mapResult } = useQuery(GET_MAP);
const mapFields = computed(() => mapResult.value?.getMap?.fields ?? []);

// ---- Run starten ----
// startRun ist idempotent: existiert bereits ein aktiver Run für diesen
// User+Lerngruppe, gibt das Backend diesen unverändert zurück (mit der echten
// currentPosition) und ignoriert dabei die übergebene selectedStartFieldPosition.
// D.h. der Klick auf ein Startfeld dient bei einem bestehenden Run praktisch nur
// als "Weiter"-Klick — angezeigt wird danach trotzdem immer der korrekte Fortschritt.
const START_RUN = gql`
  mutation StartRun($studyGroupId: ID!, $selectedStartFieldPosition: Int!) {
    startRun(studyGroupId: $studyGroupId, selectedStartFieldPosition: $selectedStartFieldPosition) {
      id
      successful
      currentPosition
      player {
        level
        maxHealth
        currentHealth
      }
    }
  }
`;
const { mutate: startRunMutation } = useMutation(START_RUN);

// ---- Auf der Map bewegen (jeder weitere Feld-Klick) ----
const MOVE_TO_FIELD = gql`
  mutation MoveToField($runId: ID!, $targetPosition: Int!) {
    moveToField(runId: $runId, targetPosition: $targetPosition) {
      run {
        id
        successful
        currentPosition
        player {
          level
          maxHealth
          currentHealth
        }
        deck {
          id
        }
      }
      combat {
        id
        isPlayerTurn
        status
        enemy {
          name
          type
          maxHealth
          currentHealth
          baseDamage
        }
        hand {
          id
          question
          groupStats {
            totalAttempts
            correctAnswers
          }
        }
      }
    }
  }
`;
const { mutate: moveToFieldMutation } = useMutation(MOVE_TO_FIELD);

// ---- Karte im Kampf beantworten ----
// Der Server liefert jetzt den vollständig aktualisierten Kampf-Zustand direkt mit
// zurück (Hand, Gegner-HP, Status) — kein Client-seitiges Rätselraten mehr nötig.
const ANSWER_CARD = gql`
  mutation AnswerCard($runId: ID!, $cardId: ID!, $userAnswer: String!) {
    answerCard(runId: $runId, cardId: $cardId, userAnswer: $userAnswer) {
      correct
      damageDealt
      correctAnswer
      combat {
        id
        isPlayerTurn
        status
        enemy {
          name
          type
          maxHealth
          currentHealth
          baseDamage
        }
        hand {
          id
          question
          groupStats {
            totalAttempts
            correctAnswers
          }
        }
      }
      player {
        level
        maxHealth
        currentHealth
      }
    }
  }
`;
const { mutate: answerCardMutation } = useMutation(ANSWER_CARD);

// ---- State ----
const run = ref(null); // aktueller Run, sobald startRun geantwortet hat
const currentCombat = ref(null); // aktuelles Combat-Objekt, solange phase === 'combat'
// Reaktive Kopie der Handkarten (mit _isNew-Flag für die Fly-in-Animation),
// wird bei jeder answerCard-Antwort komplett aus dem Server-Combat übernommen.
const hand = ref([]);
// Nur für die Deck-Zähler-Anzeige (🃏 X) — kein Zustand, der Spiellogik beeinflusst.
const deckRemaining = ref(0);
const phase = ref('map'); // 'map' | 'combat'
const mapPhase = ref('select-start'); // 'select-start' (noch kein Run) | 'select-next' (an RunMapView weitergereicht)
const combatViewRef = ref(null);
const actionError = ref(null);

const currentPosition = computed(() => run.value?.currentPosition ?? null);
const playerHp = computed(() => run.value?.player?.currentHealth ?? 100);
const playerMaxHp = computed(() => run.value?.player?.maxHealth ?? 100);

// CombatView erwartet enemy.baseHealth (Anzeige-Prop), das Backend liefert enemy.maxHealth (CombatEnemy) — hier gemappt
const enemyForView = computed(() => {
  if (!currentCombat.value) return null;
  return {
    name: currentCombat.value.enemy.name,
    baseHealth: currentCombat.value.enemy.maxHealth,
  };
});
const enemyHp = computed(() => currentCombat.value?.enemy?.currentHealth ?? 0);
const handForView = computed(() => hand.value);
const deckCount = computed(() =>
  phase.value === 'combat' ? deckRemaining.value : run.value?.deck?.length ?? 0,
);

async function onFieldSelected(field) {
  actionError.value = null;

  try {
    if (!run.value) {
      // Erster Klick: Startfeld wählen. Legt entweder einen neuen Run an dieser
      // Position an, oder lädt (falls schon einer läuft) den bestehenden Run
      // mit seinem echten Fortschritt — siehe Kommentar bei START_RUN oben.
      const { data } = await startRunMutation({
        studyGroupId: props.studyGroupId,
        selectedStartFieldPosition: field.position,
      });
      run.value = data.startRun;
      mapPhase.value = 'select-next';
      return;
    }

    const { data } = await moveToFieldMutation({
      runId: run.value.id,
      targetPosition: field.position,
    });

    run.value = data.moveToField.run;

    if (data.moveToField.combat) {
      currentCombat.value = data.moveToField.combat;
      hand.value = currentCombat.value.hand.map((c) => ({ ...c, _isNew: false }));
      deckRemaining.value = data.moveToField.run.deck?.length ?? 0;
      phase.value = 'combat';
    } else {
      mapPhase.value = 'select-next';
    }
  } catch (err) {
    actionError.value = err.message ?? 'Zug konnte nicht ausgeführt werden.';
    console.error(err);
  }
}

async function onCardPlayed({ card, answer }) {
  actionError.value = null;
  let result;

  try {
    const { data } = await answerCardMutation({
      runId: run.value.id,
      cardId: card.id,
      userAnswer: answer,
    });
    result = data.answerCard;
  } catch (err) {
    actionError.value = err.message ?? 'Antwort konnte nicht verarbeitet werden.';
    console.error(err);
    return;
  }

  // Overlay-Feedback (richtig/falsch + korrekte Antwort) und Sprite-Animation
  // laufen parallel; wir warten auf beides, bevor der State weiterverarbeitet wird.
  await Promise.all([
    combatViewRef.value?.resolveAnswer({ correct: result.correct, correctAnswer: result.correctAnswer }),
    combatViewRef.value?.playCombatAnimation(result.correct),
  ]);

  // Server liefert Hand/Gegner-HP/Status jetzt komplett aktualisiert mit —
  // wir übernehmen das 1:1 und markieren nur die neuen Karten für die Fly-in-Animation.
  const previousHandIds = new Set(hand.value.map((c) => c.id));
  const newHand = result.combat.hand.map((c) => ({
    ...c,
    _isNew: !previousHandIds.has(c.id),
  }));
  const drawnCount = newHand.filter((c) => c._isNew).length;

  currentCombat.value = result.combat;
  hand.value = newHand;
  deckRemaining.value = Math.max(0, deckRemaining.value - drawnCount);

  // Server liefert jetzt auch den aktualisierten Spieler-Zustand direkt mit
  // (Gegenangriff, Perfekt-Runden-Heilung, Level-Up sind hier schon eingerechnet).
  if (run.value) {
    run.value.player = result.player;
  }

  if (result.combat.status === 'WON' || result.combat.status === 'LOST') {
    phase.value = 'map';
    mapPhase.value = 'select-next';
    currentCombat.value = null;
    hand.value = [];
    deckRemaining.value = 0;
  }
}
</script>

<style scoped>
.run-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.run-error {
  color: #dc2626;
  font-size: 0.9rem;
  padding: 0.5rem 1rem;
  margin: 0;
}
</style>