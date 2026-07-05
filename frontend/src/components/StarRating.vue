<script setup>
import { ref, onMounted } from 'vue'
import styles from './StarRating.module.css'

const props = defineProps({
  modelValue: { type: Number, default: 0 },
  readonly: { type: Boolean, default: false },
  size: { type: [Number, String], default: 32 },
})

const emit = defineEmits(['update:modelValue'])

const hovered = ref(0)
const animating = ref(0)

// Animate on mount if value is 3 (default)
onMounted(() => {
  if (props.modelValue > 0 && props.modelValue === 3) {
    for (let i = 1; i <= props.modelValue; i++) {
      setTimeout(() => (animating.value = i), i * 100)
    }
    setTimeout(() => (animating.value = 0), props.modelValue * 100 + 300)
  }
})

function handleClick(rating) {
  if (props.readonly) return
  emit('update:modelValue', rating)

  // Pop animation
  for (let i = 1; i <= rating; i++) {
    setTimeout(() => (animating.value = i), i * 60)
  }
  setTimeout(() => (animating.value = 0), rating * 60 + 300)
}

function handleMouseEnter(rating) {
  if (!props.readonly) hovered.value = rating
}

function handleMouseLeave() {
  if (!props.readonly) hovered.value = 0
}

const displayValue = () => hovered.value || props.modelValue || 0

const hints = ['', '糟糕', '一般', '不错', '很好', '完美']
</script>

<template>
  <div :class="styles.container" role="radiogroup" aria-label="满意度评分">
    <button
      v-for="star in 5"
      :key="star"
      :class="[
        styles.star,
        star <= displayValue() && styles.active,
        !readonly && styles.interactive,
        animating === star && styles.animate,
      ]"
      type="button"
      @click="handleClick(star)"
      @mouseenter="handleMouseEnter(star)"
      @mouseleave="handleMouseLeave"
      :disabled="readonly"
      :aria-label="`${star}星`"
      :aria-checked="star <= modelValue"
      role="radio"
      :style="{ '--star-size': `${size}px` }"
    >
      <svg
        viewBox="0 0 24 24"
        :width="size"
        :height="size"
        :fill="star <= displayValue() ? 'currentColor' : 'none'"
        stroke="currentColor"
        stroke-width="1.5"
      >
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    </button>
    <span :class="styles.hint">
      {{ displayValue() > 0 ? hints[displayValue()] : '' }}
    </span>
  </div>
</template>
