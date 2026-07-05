<template>
  <div class="run-view">
    <p v-if="activeRunLoading" class="run-loading">Run wird geladen...</p>

    <template v-else>
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
        @endTurn="onEndTurn"
      />
    </template>

    <p v-if="actionError" class="run-error">{{ actionError }}</p>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useQuery, useMutation, useSubscription } from '@vue/apollo-composable';
import { gql } from '@apollo/client/core';
import RunMapView from './RunMapView.vue';
import CombatView from './CombatView.vue';

const props = defineProps({
  studyGroupId: { type: String, required: true },
});
const emit = defineEmits(['runEnded']);

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

// ---- Aktiven Run (inkl. laufendem Kampf) beim Mounten wiederherstellen ----
// Ohne das würde ein Reload den kompletten Fortschritt "vergessen", obwohl
// server-seitig noch alles läuft — siehe getActiveRun im Backend.
const GET_ACTIVE_RUN = gql`
  query GetActiveRun($studyGroupId: ID!) {
    getActiveRun(studyGroupId: $studyGroupId) {
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
      activeCombat {
        id
        isPlayerTurn
        status
        deckCount
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
const { result: activeRunResult, loading: activeRunLoading, error: activeRunError } = useQuery(
  GET_ACTIVE_RUN,
  () => ({ studyGroupId: props.studyGroupId }),
  () => ({ enabled: !!props.studyGroupId }),
);

// ---- Run-Updates in Echtzeit (z.B. bei zwei offenen Tabs, oder falls jemand
// anderes in der Gruppe den Fortschritt live mitverfolgt) ----
const ON_RUN_UPDATED = gql`
  subscription OnRunUpdated($runId: ID!) {
    onRunUpdated(runId: $runId) {
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
  }
`;

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
        deckCount
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
        deckCount
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

// ---- Runde freiwillig beenden (ohne alle Handkarten zu spielen) ----
const END_TURN = gql`
  mutation EndTurn($runId: ID!) {
    endTurn(runId: $runId) {
      combat {
        id
        isPlayerTurn
        status
        deckCount
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
const { mutate: endTurnMutation } = useMutation(END_TURN);

// ---- State ----
const run = ref(null); // aktueller Run, sobald startRun geantwortet hat
const currentCombat = ref(null); // aktuelles Combat-Objekt, solange phase === 'combat'
// Reaktive Kopie der Handkarten (mit _isNew-Flag für die Fly-in-Animation),
// wird bei jeder answerCard-Antwort komplett aus dem Server-Combat übernommen.
const hand = ref([]);
const phase = ref('map'); // 'map' | 'combat'
const mapPhase = ref('select-start'); // 'select-start' (noch kein Run) | 'select-next' (an RunMapView weitergereicht)
const combatViewRef = ref(null);
const actionError = ref(null);

// Muss NACH der Deklaration von `run` stehen, da die reaktiven Getter unten
// sofort beim Setup ausgeführt werden und sonst auf `run` zugreifen, bevor es existiert.
const { result: runUpdateResult } = useSubscription(
  ON_RUN_UPDATED,
  () => ({ runId: run.value?.id }),
  () => ({ enabled: !!run.value?.id }),
);

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
  phase.value === 'combat' ? (currentCombat.value?.deckCount ?? 0) : (run.value?.deck?.length ?? 0),
);

// Sobald getActiveRun geladen hat: bestehenden Fortschritt übernehmen.
// Kommt null zurück, existiert kein aktiver Run -> Startfeld-Auswahl bleibt sichtbar.
let resumed = false;
watch(
  activeRunLoading,
  (loading) => {
    if (loading || resumed) return;
    if (!props.studyGroupId) return; // Query war deaktiviert, noch keine studyGroupId da
    resumed = true;

    if (activeRunError.value) {
      actionError.value =
        activeRunError.value.message ?? 'Aktiver Run konnte nicht geladen werden.';
      console.error('getActiveRun failed:', activeRunError.value);
      return;
    }

    const activeRun = activeRunResult.value?.getActiveRun;
    if (!activeRun) return;

    run.value = activeRun;
    mapPhase.value = 'select-next';

    if (activeRun.activeCombat) {
      currentCombat.value = activeRun.activeCombat;
      hand.value = currentCombat.value.hand.map((c) => ({ ...c, _isNew: false }));
      phase.value = 'combat';
    }
  },
  { immediate: true },
);

// Ein einzelner Kampf kann enden (WON/LOST), ohne dass der ganze Run vorbei ist —
// das Backend beendet den Run (endRunModel) nur bei Niederlage oder Boss-Sieg.
// enemy.type kennen wir schon aus der Combat-Query, brauchen also keine extra Anfrage.
function handleCombatEnd(combat) {
  if (combat.status !== 'WON' && combat.status !== 'LOST') return;

  const wholeRunEnded = combat.status === 'LOST' || combat.enemy.type === 'BOSS';

  currentCombat.value = null;
  hand.value = [];

  if (wholeRunEnded) {
    emit('runEnded', { successful: combat.status === 'WON' });
    return;
  }

  phase.value = 'map';
  mapPhase.value = 'select-next';
}

// Kommt ein Update über die Subscription rein (z.B. weil der Run in einem anderen
// Tab weitergespielt wurde), Zustand übernehmen. Ist der Run dabei zu Ende gegangen,
// ohne dass wir das schon lokal über handleCombatEnd gemeldet haben, jetzt nachholen.
watch(runUpdateResult, (val) => {
  const updated = val?.onRunUpdated;
  if (!updated || !run.value) return;

  run.value = { ...run.value, ...updated };

  if (updated.successful !== null && phase.value !== 'combat') {
    emit('runEnded', { successful: updated.successful });
  }
});

async function onFieldSelected(field) {
  actionError.value = null;

  if (!props.studyGroupId) {
    actionError.value = 'Keine Lerngruppe ausgewählt — bitte Seite neu laden.';
    return;
  }

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

    currentCombat.value = result.combat;
    hand.value = newHand;

    // Server liefert jetzt auch den aktualisierten Spieler-Zustand direkt mit
    // (Gegenangriff, Perfekt-Runden-Heilung, Level-Up sind hier schon eingerechnet).
    // Wichtig: run.value stammt aus einem Apollo-Ergebnis und ist eingefroren (Object.freeze) —
    // direktes Zuweisen einer Property crasht deshalb. Stattdessen ein neues Objekt bauen.
    if (run.value) {
      run.value = { ...run.value, player: result.player };
    }

    if (result.combat.status === 'WON' || result.combat.status === 'LOST') {
      handleCombatEnd(result.combat);
    }
  } catch (err) {
    actionError.value = err.message ?? 'Antwort konnte nicht verarbeitet werden.';
    console.error('onCardPlayed failed:', err);
  }
}

// Freiwilliges Zugende: keine Karte/Antwort, deshalb kein Overlay-Feedback —
// nur der Gegenangriff (Sprite-Animation) und die Hand-Aktualisierung.
async function onEndTurn() {
  actionError.value = null;

  try {
    const { data } = await endTurnMutation({ runId: run.value.id });
    const result = data.endTurn;

    await combatViewRef.value?.playCombatAnimation(false);

    const previousHandIds = new Set(hand.value.map((c) => c.id));
    const newHand = result.combat.hand.map((c) => ({
      ...c,
      _isNew: !previousHandIds.has(c.id),
    }));

    currentCombat.value = result.combat;
    hand.value = newHand;

    if (run.value) {
      run.value = { ...run.value, player: result.player };
    }

    if (result.combat.status === 'WON' || result.combat.status === 'LOST') {
      handleCombatEnd(result.combat);
    }
  } catch (err) {
    actionError.value = err.message ?? 'Runde konnte nicht beendet werden.';
    console.error('onEndTurn failed:', err);
  } finally {
    combatViewRef.value?.finishEndTurn();
  }
}
</script>

<style scoped>
.run-view {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.run-loading {
  padding: 1rem;
  color: var(--color-text);
  opacity: 0.7;
}

.run-error {
  color: #dc2626;
  font-size: 0.9rem;
  padding: 0.5rem 1rem;
  margin: 0;
}
</style>