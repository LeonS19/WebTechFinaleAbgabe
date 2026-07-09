<template>
  <div class="auth-container">
    <h1>Registrieren</h1>
    <button @click="registerWithGoogle">Mit Google registrieren</button>
    <hr />
    <h2>Mit Passkey registrieren</h2>
    <input v-model="name" type="text" placeholder="Benutzername" />
    <input v-model="email" type="email" placeholder="E-Mail-Adresse" />
    <button @click="registerPasskey">Passkey registrieren</button>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="success" class="success">{{ success }}</p>
    <p>Bereits registriert? <RouterLink to="/login">Login</RouterLink></p>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { startRegistration } from '@simplewebauthn/browser';

const router = useRouter();
const name = ref('');
const email = ref('');
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
    if (!name.value) throw new Error('Bitte Benutzername eingeben');
    if (!email.value) throw new Error('Bitte E-Mail-Adresse eingeben');
    if (!email.value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      throw new Error('Bitte gültige E-Mail-Adresse eingeben');
    }

    // Schritt 1: User anlegen oder finden
    const userRes = await fetch(`${BASE_URL}/auth/passkey/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.value, email: email.value }),
    });
    const userData = await userRes.json();
    if (!userRes.ok) throw new Error(userData.error || 'User konnte nicht angelegt werden');
    const userId = userData.userId;

    // Schritt 2: Options holen
    const optionsRes = await fetch(`${BASE_URL}/auth/passkey/register/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userEmail: email.value }),
    });
    const { options, challengeId } = await optionsRes.json();

    // Schritt 3: Browser WebAuthn API
    const response = await startRegistration({ optionsJSON: options });

    // Schritt 4: Verify + Token direkt aus Antwort nehmen
    const verifyRes = await fetch(`${BASE_URL}/auth/passkey/register/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeId,
        response,
        userId,
      }),
    });
    const data = await verifyRes.json();
    if (!verifyRes.ok) throw new Error(data.error || 'Registrierung fehlgeschlagen');
    localStorage.setItem('token', data.token);
    router.push('/dashboard');
  } catch (err) {
    error.value = err.message || 'Registrierung fehlgeschlagen';
  }
}
</script>