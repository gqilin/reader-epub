<script setup lang="ts">
defineProps<{
  visible: boolean;
  src: string;
  alt: string;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <Teleport to="body">
    <Transition name="image-preview">
      <div v-if="visible" class="image-preview-overlay" @click="emit('close')">
        <div class="image-preview-container" @click.stop>
          <button class="close-btn" @click="emit('close')">&#10005;</button>
          <img :src="src" :alt="alt" class="preview-image" />
          <p v-if="alt" class="image-alt">{{ alt }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.image-preview-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.image-preview-container {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.close-btn {
  position: absolute;
  top: -40px;
  right: -8px;
  background: none;
  border: none;
  font-size: 28px;
  color: #fff;
  cursor: pointer;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.15s;

  &:hover {
    background: rgba(255, 255, 255, 0.15);
  }
}

.preview-image {
  max-width: 90vw;
  max-height: 85vh;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 4px 32px rgba(0, 0, 0, 0.4);
}

.image-alt {
  margin-top: 12px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 14px;
  text-align: center;
  max-width: 80vw;
  word-break: break-word;
}

// Transition
.image-preview-enter-active,
.image-preview-leave-active {
  transition: opacity 0.2s ease;

  .image-preview-container {
    transition: transform 0.2s ease;
  }
}

.image-preview-enter-from,
.image-preview-leave-to {
  opacity: 0;

  .image-preview-container {
    transform: scale(0.9);
  }
}
</style>
