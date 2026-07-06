<template>
  <div class="chat-panel-overlay" v-if="visible">
    <chat-window
      :chat-id="chatId"
      :token="token"
      :username="username"
      :role="role"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  visible: Boolean,
  chatId: String,
  username: String,
  role: String,
});

const token = computed(() => localStorage.getItem('token') || '');
</script>