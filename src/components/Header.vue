<script setup>
defineProps(['title'])
</script>

<template>
  <div class="throwform-header">
    <h1 class="brand-name">{{ title }}</h1>
    <svg class="wavy-line" viewBox="0 0 300 20" preserveAspectRatio="none">
      <path
        d="M0,10 Q15,2 30,10 T60,10 T90,10 T120,10 T150,10 T180,10 T210,10 T240,10 T270,10 T300,10"
        stroke="#B7503A"
        stroke-width="2"
        fill="none"
        opacity="0.6"
      />
    </svg>
    <span class="brand-tagline">pottery configurator</span>
  </div>
</template>

<style scoped>
.throwform-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 24px;
  height: 45px;
  background-color: #FFFBF0;
  flex-shrink: 0;
}

.brand-name {
  font-family: 'Poppins', sans-serif;
  font-size: 1.3rem;
  font-weight: 700;
  color: #332824;
  letter-spacing: 0.04em;
  margin: 0;
  white-space: nowrap;
}

.wavy-line {
  width: 80px;
  height: 20px;
  flex-shrink: 0;
}

.brand-tagline {
  font-family: 'Poppins', sans-serif;
  font-size: 0.7rem;
  font-weight: 400;
  color: #B7503A;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  white-space: nowrap;
}
</style>
