<script setup lang="ts">
import { provide, ref, onMounted, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { Loading } from '@element-plus/icons-vue';
import SideBar from '../components/SideBar.vue';
import ToolBar from '../components/ToolBar.vue';
import ReaderView from '../components/ReaderView.vue';
import FooterBar from '../components/FooterBar.vue';
import RightPanel from '../components/RightPanel.vue';
import SelectionToolbar from '../components/SelectionToolbar.vue';
import NoteDialog from '../components/NoteDialog.vue';
import { useEpubReader } from '../composables/useEpubReader';
import { consumePendingBuffer } from '../composables/epubStore';

const route = useRoute();
const epub = useEpubReader();
provide('epub', epub);

const viewerRef = ref<HTMLElement | null>(null);
const urlLoading = ref(false);
const loadError = ref('');

function setViewerRef(el: HTMLElement) {
  viewerRef.value = el;
}

/**
 * Wait for the viewer DOM element to be ready.
 * After urlLoading turns false, ReaderView re-mounts and emits viewerMounted.
 * We use nextTick to wait for that DOM update.
 */
async function waitForViewer(): Promise<HTMLElement | null> {
  await nextTick();
  // viewerRef should now point to the newly mounted element
  return viewerRef.value;
}

async function autoLoad() {
  if (epub.isLoaded.value) return;

  // 1. Load from URL query param
  const url = route.query.url as string | undefined;
  if (url) {
    urlLoading.value = true;
    loadError.value = '';
    try {
      await epub.loadUrl(url);
    } catch (e: any) {
      loadError.value = e.message || '加载失败';
      return;
    } finally {
      urlLoading.value = false;
    }
    const el = await waitForViewer();
    if (el) await epub.createRenderer(el);
    return;
  }

  // 2. Load from in-memory buffer (set by HomePage)
  const buffer = consumePendingBuffer();
  if (buffer) {
    urlLoading.value = true;
    loadError.value = '';
    try {
      await epub.loadArrayBuffer(buffer);
    } catch (e: any) {
      loadError.value = e.message || '加载失败';
      return;
    } finally {
      urlLoading.value = false;
    }
    const el = await waitForViewer();
    if (el) await epub.createRenderer(el);
  }
}

async function onFileLoaded(file: File) {
  loadError.value = '';
  await epub.loadFile(file);
  if (viewerRef.value) {
    await epub.createRenderer(viewerRef.value);
  }
}

async function onSwitchMode(mode: 'paginated' | 'scrolled') {
  if (viewerRef.value) {
    await epub.switchMode(mode, viewerRef.value);
  }
}

onMounted(() => {
  // Wait a tick for the viewer element to be ready
  setTimeout(autoLoad, 100);
});
</script>

<template>
  <div class="reader-page">
    <SideBar
      :book-title="epub.bookTitle.value"
      :book-author="epub.bookAuthor.value"
      :toc-items="epub.tocItems.value"
      :is-loaded="epub.isLoaded.value"
      :active-toc-id="epub.activeTocId.value"
      @load-file="onFileLoaded"
      @toc-click="epub.goToTocItem"
    />
    <div class="main">
      <div v-if="urlLoading" class="loading-overlay">
        <el-icon class="is-loading" :size="32" color="#409EFF"><Loading /></el-icon>
        <p>正在加载 EPUB...</p>
      </div>
      <div v-else-if="loadError" class="error-overlay">
        <el-result icon="error" title="加载失败" :sub-title="loadError">
          <template #extra>
            <el-button type="primary" @click="$router.push('/')">返回首页</el-button>
          </template>
        </el-result>
      </div>
      <template v-else>
        <ToolBar
          v-if="epub.isLoaded.value"
          :selected-color="epub.selectedColor.value"
          :selected-underline-style="epub.selectedUnderlineStyle.value"
          :underline-color="epub.underlineColor.value"
          :highlight-custom-color="epub.highlightCustomColor.value"
          @set-mode="epub.setAnnotationMode"
          @set-color="epub.setSelectedColor"
          @set-custom-color="epub.setCustomHighlightColor"
          @set-underline-style="(s: any) => epub.selectedUnderlineStyle.value = s"
          @set-underline-color="(c: string) => epub.underlineColor.value = c"
          @highlight="epub.highlight"
          @underline="epub.underline"
          @add-note="epub.addNote"
          @go-cfi="epub.goToCfi"
        />
        <ReaderView
          :is-loaded="epub.isLoaded.value"
          :spread="epub.spreadEnabled.value"
          @viewer-mounted="setViewerRef"
        />
        <FooterBar
          v-if="epub.isLoaded.value"
          :current-mode="epub.currentMode.value"
          :progress-text="epub.progressText.value"
          @prev="epub.prev"
          @next="epub.next"
        />
      </template>
    </div>
    <RightPanel
      v-if="epub.isLoaded.value"
      :annotation-list="epub.annotationList.value"
      :annotation-count="epub.annotationCount.value"
      :current-mode="epub.currentMode.value"
      :spread-enabled="epub.spreadEnabled.value"
      :theme-name="epub.themeName.value"
      :font-family="epub.fontFamily.value"
      :font-size="epub.fontSize.value"
      :line-height="epub.lineHeight.value"
      @go-to-annotation="epub.goToAnnotation"
      @remove-annotation="epub.removeAnnotation"
      @export-annotations="epub.exportAnnotations"
      @import-annotations="epub.importAnnotations"
      @clear-annotations="epub.clearAnnotations"
      @update-theme="epub.updateTheme"
      @set-font-family="epub.setFontFamily"
      @set-font-size="epub.setFontSizeAbsolute"
      @set-line-height="epub.setLineHeight"
      @switch-mode="onSwitchMode"
      @toggle-spread="epub.toggleSpread"
      @reset-theme="epub.resetTheme"
    />
    <SelectionToolbar
      :visible="epub.selectionToolbar.value.visible"
      :position="epub.selectionToolbar.value.position"
      :selected-color="epub.selectedColor.value"
      @highlight="epub.selectionHighlight"
      @underline="epub.selectionUnderline"
      @add-note="epub.selectionAddNote"
      @copy="epub.selectionCopy"
      @set-color="epub.setSelectedColor"
    />
    <NoteDialog
      :visible="epub.noteDialog.value.visible"
      :source="epub.noteDialog.value.source"
      :content="epub.noteDialog.value.content"
      @confirm="(content) => {
        epub.noteDialog.value.content = content;
        epub.confirmNoteDialog();
      }"
      @cancel="epub.closeNoteDialog"
    />
  </div>
</template>

<style lang="scss" scoped>
.reader-page {
  display: flex;
  height: 100vh;
}

.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.loading-overlay,
.error-overlay {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #606266;
}
</style>
