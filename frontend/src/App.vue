<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <header>
    <nav>
      <RouterLink to="/login">Login</RouterLink>
      <RouterLink to="/register">Registrieren</RouterLink>
    </nav>
  </header>
  <RouterView />
</template>

<!-- <script setup>
import { RouterView } from 'vue-router'
</script>

<template>
  <RouterView />
</template> -->

<style scoped>
header {
  padding: 1rem;
}
nav {
  display: flex;
  gap: 1rem;
}
nav a {
  text-decoration: none;
  color: var(--color-text);
}
nav a.router-link-exact-active {
  font-weight: bold;
}
</style>