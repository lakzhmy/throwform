<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  title: String,
  myValue: Number,
  min: { default: 1 },
  max: { default: 10 },
  step: { default: 1 },
})

const title = ref(props.title)
const myValue = ref(props.myValue)

// Sync when parent changes the value externally
watch(() => props.myValue, (newVal) => {
  if (newVal != null) myValue.value = newVal
})

const emits = defineEmits(['update'])

function sendValueUpdate() {
  emits('update', myValue.value, title.value)
}
</script>

<template>
  <div class="slider-input">
    <div class="slider-header">
      <label class="slider-label">{{ title }}</label>
      <span class="slider-value">{{ Number(myValue) }}</span>
    </div>
    <input
      type="range"
      class="styled-range"
      :min="props.min"
      :max="props.max"
      :step="props.step"
      v-model="myValue"
      @mouseup="sendValueUpdate"
      @touchend="sendValueUpdate"
    />
  </div>
</template>

<style scoped>
.slider-input {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.slider-label {
  font-family: 'Poppins', sans-serif;
  font-size: 0.8rem;
  font-weight: 600;
  color: #1d1d1b;
}

.slider-value {
  font-family: 'Poppins', sans-serif;
  font-size: 0.75rem;
  font-weight: 400;
  color: #724537;
}

.styled-range {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  background: linear-gradient(90deg, #FFFBF0, #724537);
  height: 8px;
  border-radius: 4px;
  border: none;
  outline: none;
  margin: 4px 0;
}

.styled-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 16px;
  width: 16px;
  border-radius: 50%;
  background-color: #B7503A;
  cursor: pointer;
  border: 2px solid #FFFBF0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.styled-range::-moz-range-thumb {
  height: 16px;
  width: 16px;
  border-radius: 50%;
  background-color: #B7503A;
  cursor: pointer;
  border: 2px solid #FFFBF0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
</style>
