<template>
  <div>Wird weitergeleitet...</div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

onMounted(() => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const errorMsg = params.get('message');

  if (token) {
    localStorage.setItem('token', token);
    router.push('/');
  } else {
    router.push(`/login?error=${errorMsg || 'OAuth fehlgeschlagen'}`);
  }
});
</script>