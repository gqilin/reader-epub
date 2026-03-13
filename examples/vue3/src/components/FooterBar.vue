<script setup lang="ts">
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue';

defineProps<{
  currentMode: 'paginated' | 'scrolled';
  progressText: string;
}>();

const emit = defineEmits<{
  prev: [];
  next: [];
}>();
</script>

<template>
  <div class="footer">
    <div class="nav-buttons">
      <el-button :icon="ArrowLeft" @click="emit('prev')">
        {{ currentMode === 'scrolled' ? 'Prev Chapter' : 'Previous' }}
      </el-button>
      <el-button :icon="ArrowRight" @click="emit('next')">
        {{ currentMode === 'scrolled' ? 'Next Chapter' : 'Next' }}
      </el-button>
    </div>
    <span class="progress-info">{{ progressText }}</span>
  </div>
</template>

<style lang="scss" scoped>
.footer {
  padding: 8px 16px;
  background: #fff;
  border-top: 1px solid #e0e0e0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  color: #666;

  .nav-buttons {
    display: flex;
    gap: 8px;
  }

  .progress-info {
    min-width: 200px;
    text-align: right;
  }
}
</style>
