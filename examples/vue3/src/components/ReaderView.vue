<script setup lang="ts">
import { ref, onMounted } from 'vue';

defineProps<{
  isLoaded: boolean;
  spread: boolean;
}>();

const emit = defineEmits<{
  viewerMounted: [el: HTMLElement];
}>();

const viewerEl = ref<HTMLElement | null>(null);

onMounted(() => {
  if (viewerEl.value) {
    emit('viewerMounted', viewerEl.value);
  }
});
</script>

<template>
  <div class="reader-container">
    <div ref="viewerEl" id="epub-viewer" :class="{ 'spread-mode': spread }">
      <el-empty v-if="!isLoaded" description="Select an EPUB file to start reading" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.reader-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow: hidden;
}

#epub-viewer {
  width: 100%;
  max-width: 800px;
  height: 100%;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: max-width 0.3s ease;

  &.spread-mode {
    max-width: 1400px;
  }
}
</style>
