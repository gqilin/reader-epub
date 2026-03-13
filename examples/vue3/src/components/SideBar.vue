<script setup lang="ts">
import type { TocItem } from 'epub-reader';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { Upload } from '@element-plus/icons-vue';
import TocNode from './TocNode.vue';

defineProps<{
  bookTitle: string;
  bookAuthor: string;
  tocItems: TocItem[];
  isLoaded: boolean;
}>();

const emit = defineEmits<{
  loadFile: [file: File];
  tocClick: [item: TocItem];
}>();

const router = useRouter();
const activeTocLabel = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);

function triggerFileInput() {
  fileInputRef.value?.click();
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) emit('loadFile', file);
}

function onTocClick(item: TocItem) {
  activeTocLabel.value = item.label;
  emit('tocClick', item);
}
</script>

<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-title-row">
        <h2>EPUB Reader</h2>
        <el-button text size="small" @click="router.push('/about')">About</el-button>
      </div>
      <input
        ref="fileInputRef"
        type="file"
        accept=".epub"
        style="display: none"
        @change="onFileChange"
      >
      <el-button type="primary" :icon="Upload" @click="triggerFileInput" style="width: 100%;">
        Open EPUB
      </el-button>
    </div>

    <div v-if="isLoaded" class="book-info">
      <div class="title">{{ bookTitle }}</div>
      <div class="author">{{ bookAuthor }}</div>
    </div>

    <el-scrollbar class="toc-scroll">
      <div class="toc">
        <TocNode
          v-for="item in tocItems"
          :key="item.label"
          :item="item"
          :level="0"
          :active-label="activeTocLabel"
          @click-item="onTocClick"
        />
      </div>
    </el-scrollbar>
  </div>
</template>

<style lang="scss" scoped>
.sidebar {
  width: 300px;
  background: #fff;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .sidebar-header {
    padding: 16px;
    border-bottom: 1px solid #e0e0e0;

    .sidebar-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;

      h2 {
        font-size: 16px;
      }
    }
  }

  .book-info {
    padding: 12px 16px;
    border-bottom: 1px solid #e0e0e0;
    font-size: 13px;

    .title {
      font-weight: 600;
      font-size: 15px;
      margin-bottom: 4px;
    }

    .author {
      color: #666;
    }
  }

  .toc-scroll {
    flex: 1;
  }

  .toc {
    padding: 8px 0;
  }
}
</style>
