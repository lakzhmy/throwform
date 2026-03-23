<script setup>
import { store } from './stores/storeSingletons'
import ThrowForm from './ThrowForm.vue'
</script>

<template>
  <ThrowForm />

  <div v-if="store.computing" class="loading-overlay">
    <div class="loading-container">
      <div class="spinner"></div>
      <p class="computing-label">Computing...</p>
    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');

html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  backdrop-filter: blur(2px);
  background-image: linear-gradient(rgba(168, 181, 192, 0.649) 80%, transparent);
  height: 100%;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
  flex-direction: column;
  z-index: 100;
}

.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  gap: 12px;
}

.spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(114, 69, 55, 0.2);
  border-top-color: #724537;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.computing-label {
  color: #2c3e50;
  font-family: 'Poppins', sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0;
}
</style>
