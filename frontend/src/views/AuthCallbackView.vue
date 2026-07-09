<template>
  <div>Wird weitergeleitet...</div>
</template>
<script setup>
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

onMounted(async () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const errorMsg = params.get('message');

  if (!code) {
    router.push(`/login?error=${errorMsg || 'OAuth fehlgeschlagen'}`);
    return;
  }

  try {
    const res = await fetch(`http://localhost:3000/api/v1/auth/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      throw new Error('Code ungültig oder abgelaufen');
    }

    const { token } = await res.json();
    localStorage.setItem('token', token);
    router.push('/dashboard');
  } catch (err) {
    router.push(`/login?error=${err.message}`);
  }
});
</script>