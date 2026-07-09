<template>
  <div class="chat-panel-overlay" v-if="visible">
    <chat-window
      ref="chatWindowEl"
      :chat-id="chatId"
      :token="token"
      :username="username"
      :role="role"
    />
  </div>
</template>
<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { cacheMessages, getCachedMessages } from '@/services/offlineStorage.service.js';

const props = defineProps({
  visible: Boolean,
  chatId: String,
  username: String,
  role: String,
});
const token = computed(() => localStorage.getItem('token') || '');

const chatWindowEl = ref(null);

function attachHooks() {
  const el = chatWindowEl.value;
  if (!el) return;

  // Live per WebSocket empfangene Nachrichten zusätzlich cachen
  // (behebt: "Live-Nachrichten werden nicht in IndexedDB gespiegelt")
  el.onMessageReceived = (message) => {
    cacheMessages([message]);
  };

  // Erfolgreich geladene Historie cachen
  el.onMessagesLoaded = (messages) => {
    cacheMessages(messages);
  };

  // Offline-Fallback: Funktion reinreichen statt sie in der Component zu importieren
  el.loadCachedMessages = (chatId) => getCachedMessages(chatId);

  el.start();
}

// v-if entfernt <chat-window> komplett aus dem DOM, wenn "visible" false wird,
// und erzeugt beim erneuten Öffnen ein NEUES Element. Die Hooks müssen deshalb
// jedes Mal neu gesetzt werden, wenn das Panel wieder sichtbar wird, nicht nur
// einmal beim ersten Mount der ChatPanel-Komponente selbst.
watch(
  () => props.visible,
  async (isVisible) => {
    if (!isVisible) return;
    await nextTick();
    attachHooks();
  },
  { immediate: true },
);
</script>