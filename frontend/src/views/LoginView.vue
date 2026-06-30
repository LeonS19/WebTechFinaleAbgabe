<template>
  <div class="auth-container">
    <h1>Login</h1>
    <button @click="loginWithGoogle">Mit Google anmelden</button>
    <hr />
    <h2>Mit Passkey anmelden</h2>
    <button @click="loginWithPasskey">Mit Passkey anmelden</button>
    <p v-if="error" class="error">{{ error }}</p>
    <p>Noch kein Konto? <RouterLink to="/register">Registrieren</RouterLink></p>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { startAuthentication } from '@simplewebauthn/browser';

const router = useRouter();
const error = ref('');
const BASE_URL = 'http://localhost:3000/api/v1';

function loginWithGoogle() {
  window.location.href = `${BASE_URL}/auth/google`;
}

async function loginWithPasskey() {
  error.value = '';
  try {
    const optionsRes = await fetch(`${BASE_URL}/auth/passkey/login/options`, {
      method: 'POST',
    });
    const { options, challengeId } = await optionsRes.json();
    const response = await startAuthentication({ optionsJSON: options });
    const verifyRes = await fetch(`${BASE_URL}/auth/passkey/login/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, response }),
    });
    if (!verifyRes.ok) {
      const data = await verifyRes.json();
      throw new Error(data.error || 'Login fehlgeschlagen');
    }
    const token = await verifyRes.json();
    localStorage.setItem('token', token);
    router.push('/dashboard');
  } catch (err) {
    error.value = err.message || 'Login fehlgeschlagen';
  }
}
</script>