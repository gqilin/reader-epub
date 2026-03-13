<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();
</script>

<template>
  <div class="about-page">
    <el-card shadow="hover" style="max-width: 600px; margin: 80px auto;">
      <template #header>
        <span>About EPUB Reader</span>
      </template>
      <p>A browser-only EPUB parsing and SVG annotation library.</p>
      <p style="margin-top: 12px; color: #999;">
        Built with Vue 3 + Element Plus + TypeScript
      </p>
      <el-button type="primary" style="margin-top: 20px;" @click="router.push('/')">
        Go to Reader
      </el-button>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
.about-page {
  min-height: 100vh;
  background: #f5f5f5;
}
</style>
