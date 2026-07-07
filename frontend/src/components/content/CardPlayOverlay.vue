<template>
  <div class="overlay-backdrop">
    <div class="overlay-card">
      <!-- Schließen Button -->
      <button class="overlay-close" @click="$emit('close')">✕</button>

      <!-- Frage -->
      <h2 class="overlay-question">{{ card.question }}</h2>

      <!-- Feedback (kommt vom Server über CombatView, sobald answerCard geantwortet hat) -->
      <div v-if="feedback?.correct === true" class="feedback feedback-correct">✓ Korrekt!</div>
      <div v-else-if="feedback?.correct === false" class="feedback feedback-wrong">
        ✗ Falsch — Richtige Antwort: <strong>{{ feedback.correctAnswer }}</strong>
      </div>

      <!-- Eingabe -->
      <div v-if="!feedback" class="overlay-input-area">
        <input
          v-model="userAnswer"
          type="text"
          placeholder="Deine Antwort..."
          :class="{ 'input-shake': shake }"
          :disabled="submitting"
          @keydown.enter="confirm"
          ref="inputRef"
        />
        <button class="primary-btn" :disabled="submitting" @click="confirm">
          {{ submitting ? 'Wird geprüft...' : 'Bestätigen' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue'

const props = defineProps({
  card: Object,
  // { correct: Boolean, correctAnswer: String } | null — wird von CombatView gesetzt,
  // sobald das Ergebnis der answerCard-Mutation da ist.
  feedback: { type: Object, default: null },
})

const emit = defineEmits(['confirm', 'close'])

const userAnswer = ref('')
const shake = ref(false)
const submitting = ref(false)
const inputRef = ref(null)

onMounted(() => {
  nextTick(() => inputRef.value?.focus())
})

function confirm() {
  if (submitting.value) return

  if (!userAnswer.value.trim()) {
    shake.value = true
    setTimeout(() => {
      shake.value = false
    }, 500)
    return
  }

  // Ob die Antwort richtig ist, weiß nur der Server (answerCard-Mutation).
  // Wir geben die rohe Antwort nach oben weiter und warten hier auf das
  // `feedback`-Prop, das CombatView setzt, sobald die Antwort da ist.
  submitting.value = true
  emit('confirm', userAnswer.value)
}
</script>

<style scoped>

.overlay-backdrop {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 55%;              /* deckt sich ungefähr mit .combat-hand */
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;   /* Klicks daneben gehen durch, nur die Karte selbst fängt Klicks ab */
}

.overlay-card {
  pointer-events: auto;
  position: relative;
  background: #f8f8f8;
  border-radius: 0.75rem;
  padding: 2rem;
  width: 90%;
  max-width: 32rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.3); 
}

.overlay-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: #2c3e50; 
  opacity: 0.6;
  line-height: 1;
}

.overlay-close:hover {
  opacity: 1;
}


.overlay-question {
  font-size: 1.3rem;
  font-weight: 700;
  text-align: center;
}

.overlay-input-area {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.overlay-input-area input {
  padding: 0.75rem 1rem;
  border: 2px solid #ddd;
  border-radius: 0.5rem;
  font-size: 1rem;
  background: #ffffff;          /* statt var(--color-background) */
  color: #2c3e50;  
  outline: none;
  transition: border-color 0.2s;
}

.overlay-input-area input::placeholder {
  color: rgba(245, 245, 245, 0.5);
}

.overlay-input-area input:focus {
  border-color: #4f8ef7;
}

.input-shake {
  animation: shake 0.4s ease;
  border-color: #f87171 !important;
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  20% {
    transform: translateX(-0.5rem);
  }
  40% {
    transform: translateX(0.5rem);
  }
  60% {
    transform: translateX(-0.5rem);
  }
  80% {
    transform: translateX(0.5rem);
  }
}

.feedback {
  text-align: center;
  font-size: 1.2rem;
  font-weight: 700;
  padding: 1rem;
  border-radius: 0.5rem;
}

.feedback-correct {
  background: #dcfce7;
  color: #166534;
}

.feedback-wrong {
  background: #fee2e2;
  color: #991b1b;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>