<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Upload, Link, Reading } from '@element-plus/icons-vue';
import { setPendingBuffer } from '../composables/epubStore';

const router = useRouter();
const urlInput = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);

function triggerFileInput() {
  fileInputRef.value?.click();
}

async function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const buffer = await file.arrayBuffer();
  setPendingBuffer(buffer);
  router.push({ name: 'reader' });
}

function openUrl() {
  const url = urlInput.value.trim();
  if (!url) return;
  router.push({ name: 'reader', query: { url } });
}

function onUrlKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') openUrl();
}
</script>

<template>
  <div class="home-page">
    <div class="home-container">
      <div class="home-header">
        <el-icon :size="48" color="#409EFF"><Reading /></el-icon>
        <h1>EPUB Reader</h1>
        <p class="subtitle">选择一种方式打开 EPUB 电子书</p>
      </div>

      <div class="cards">
        <!-- 本地文件 -->
        <div class="card" @click="triggerFileInput">
          <input
            ref="fileInputRef"
            type="file"
            accept=".epub"
            style="display: none"
            @change="onFileChange"
          >
          <div class="card-icon">
            <el-icon :size="40" color="#409EFF"><Upload /></el-icon>
          </div>
          <h3>打开本地文件</h3>
          <p>从电脑中选择一个 .epub 文件</p>
        </div>

        <!-- 网络地址 -->
        <div class="card url-card">
          <div class="card-icon">
            <el-icon :size="40" color="#409EFF"><Link /></el-icon>
          </div>
          <h3>加载网络地址</h3>
          <p>输入 .epub 文件或 container.xml / package.opf 的 URL</p>
          <div class="url-input-group" @click.stop>
            <el-input
              v-model="urlInput"
              placeholder="https://example.com/book.epub"
              clearable
              size="large"
              @keydown="onUrlKeydown"
            >
              <template #append>
                <el-button type="primary" @click="openUrl">
                  打开
                </el-button>
              </template>
            </el-input>
          </div>
        </div>
      </div>

      <div class="footer-info">
        <el-button text type="info" @click="router.push('/about')">关于</el-button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.home-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  padding: 20px;
}

.home-container {
  max-width: 720px;
  width: 100%;
}

.home-header {
  text-align: center;
  margin-bottom: 48px;
  color: #303133;

  h1 {
    font-size: 32px;
    font-weight: 600;
    margin: 16px 0 8px;
    color: #1a1a1a;
  }

  .subtitle {
    font-size: 15px;
    color: #909399;
  }
}

.cards {
  display: flex;
  gap: 24px;

  @media (max-width: 640px) {
    flex-direction: column;
  }
}

.card {
  flex: 1;
  background: #fff;
  border-radius: 12px;
  padding: 32px 24px;
  text-align: center;
  cursor: pointer;
  transition: box-shadow 0.2s;
  border: 1px solid #e4e7ed;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  }

  .card-icon {
    margin-bottom: 16px;
  }

  h3 {
    font-size: 17px;
    font-weight: 600;
    color: #303133;
    margin-bottom: 8px;
  }

  p {
    font-size: 13px;
    color: #909399;
    line-height: 1.5;
  }
}

.url-card {
  cursor: default;

  &:hover {
    box-shadow: none;
  }

  .url-input-group {
    margin-top: 16px;

    :deep(.el-input-group__append) {
      padding: 0;

      .el-button {
        margin: 0;
        border-radius: 0;
      }
    }
  }
}

.footer-info {
  text-align: center;
  margin-top: 32px;
}
</style>
