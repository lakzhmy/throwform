<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  title: String,
  val: Number,
  min: { type: Number, default: 0 },
  max: { type: Number, default: 100 },
  step: { type: Number, default: 1 },
})

const title = ref(props.title)
const currentValue = ref(props.val)

// Sync when parent changes the value externally (e.g. Wild button)
watch(() => props.val, (newVal) => {
  if (newVal != null) currentValue.value = newVal
})

const emits = defineEmits(['update'])

function increment() {
  if (currentValue.value + props.step <= props.max) {
    currentValue.value = +(currentValue.value + props.step).toFixed(2)
    emits('update', currentValue.value, title.value)
  }
}

function decrement() {
  if (currentValue.value - props.step >= props.min) {
    currentValue.value = +(currentValue.value - props.step).toFixed(2)
    emits('update', currentValue.value, title.value)
  }
}
</script>

<template>
  <div class="stepper-input">
    <label class="stepper-label">{{ title }}</label>
    <div class="stepper-controls">
      <button
        class="stepper-btn"
        @click="decrement"
        :disabled="currentValue <= min"
      >-</button>
      <span class="stepper-value">{{ currentValue }}</span>
      <button
        class="stepper-btn"
        @click="increment"
        :disabled="currentValue >= max"
      >+</button>
    </div>
  </div>
</template>

<style scoped>
.stepper-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stepper-label {
  font-family: 'Poppins', sans-serif;
  font-size: 0.8rem;
  font-weight: 600;
  color: #1d1d1b;
}

.stepper-controls {
  display: flex;
  align-items: center;
  gap: 0;
  border: 1.5px solid #724537;
  border-radius: 6px;
  overflow: hidden;
  background: #FFFBF0;
}

.stepper-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: #724537;
  color: #FFFBF0;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s;
  font-family: 'Poppins', sans-serif;
}

.stepper-btn:hover:not(:disabled) {
  background: #B7503A;
}

.stepper-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.stepper-value {
  flex: 1;
  text-align: center;
  font-family: 'Poppins', sans-serif;
  font-size: 0.85rem;
  font-weight: 600;
  color: #1d1d1b;
  min-width: 48px;
}
</style>
