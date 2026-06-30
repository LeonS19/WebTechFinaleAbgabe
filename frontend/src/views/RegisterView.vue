<template>
  <div class="auth-container">
    <h1>Registrieren</h1>

    <button @click="registerWithGoogle">Mit Google registrieren</button>

    <hr />

    <h2>Passkey hinzufügen</h2>
    <p>Du musst zuerst per Google eingeloggt sein.</p>
    <input v-model="deviceName" type="text" placeholder="Gerätename (z.B. MacBook Pro)" />
    <button @click="registerPasskey">Passkey registrieren</button>

    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="success">{{ success }}</p>
    <p>Bereits registriert? <RouterLink to="/login">Login</RouterLink></p>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { startRegistration } from '@simplewebauthn/browser';

const deviceName = ref('');
const error = ref('');
const success = ref('');
const BASE_URL = 'http://localhost:3000/api/v1';

function registerWithGoogle() {
  window.location.href = `${BASE_URL}/auth/google`;
}

async function registerPasskey() {
  error.value = '';
  success.value = '';
  try {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Du musst zuerst eingeloggt sein');

    const payload = JSON.parse(atob(token.split('.')[1]));

    const optionsRes = await fetch(`${BASE_URL}/auth/passkey/register/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: payload.id,
        userEmail: payload.email,
      }),
    });
    const { options, challengeId } = await optionsRes.json();

    const response = await startRegistration(options);

    const verifyRes = await fetch(`${BASE_URL}/auth/passkey/register/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId,
        response,
        userId: payload.id,
        deviceName: deviceName.value || 'Unbekanntes Gerät',
      }),
    });
    const data = await verifyRes.json();

    if (!verifyRes.ok) throw new Error(data.message);
    success.value = `Passkey für "${data.deviceName}" erfolgreich registriert!`;
  } catch (err) {
    error.value = err.message || 'Registrierung fehlgeschlagen';
  }
}
</script>