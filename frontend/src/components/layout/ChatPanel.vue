<template>
  <div class="chat-panel" v-if="visible">
    <!-- Wird später zur Web Component ausgebaut -->
    <p class="placeholder">Chat kommt hier rein</p>
  </div>
</template>

<script setup>
defineProps({
  visible: Boolean,
});
</script>