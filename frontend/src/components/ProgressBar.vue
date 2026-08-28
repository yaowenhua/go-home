<script setup>
import { computed } from 'vue'
import styles from './ProgressBar.module.css'

const props = defineProps({
  progress: { type: Number, default: 0 },
  passedDays: { type: Number, default: 0 },
  totalDays: { type: Number, default: 0 },
})

const clampedProgress = computed(() => Math.min(100, Math.max(0, props.progress)))
</script>

<template>
  <div :class="styles.wrapper">
    <div :class="styles.labels">
      <span :class="styles.label">
        已过 <strong>{{ passedDays?.toLocaleString() }}</strong> 天
      </span>
      <span :class="styles.label">
        约 <strong>{{ totalDays?.toLocaleString() }}</strong> 天
      </span>
    </div>
    <div :class="styles.track">
      <div
        :class="styles.fill"
        :style="{ width: `${clampedProgress}%` }"
      >
        <div :class="styles.glow" />
      </div>
      <div
        :class="styles.dot"
        :style="{ left: `${clampedProgress}%` }"
      />
    </div>
    <span :class="styles.percentage">
      已度过 {{ clampedProgress.toFixed(1) }}% 的人生
    </span>
  </div>
</template>
