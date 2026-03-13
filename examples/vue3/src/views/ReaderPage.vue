<script setup lang="ts">
import { provide, ref } from 'vue';
import SideBar from '../components/SideBar.vue';
import ToolBar from '../components/ToolBar.vue';
import ReaderView from '../components/ReaderView.vue';
import FooterBar from '../components/FooterBar.vue';
import { useEpubReader } from '../composables/useEpubReader';

const epub = useEpubReader();
provide('epub', epub);

const viewerRef = ref<HTMLElement | null>(null);

function setViewerRef(el: HTMLElement) {
  viewerRef.value = el;
}

async function onFileLoaded(file: File) {
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
</script>

<template>
  <div class="reader-page">
    <SideBar
      :book-title="epub.bookTitle.value"
      :book-author="epub.bookAuthor.value"
      :toc-items="epub.tocItems.value"
      :is-loaded="epub.isLoaded.value"
      @load-file="onFileLoaded"
      @toc-click="epub.goToTocItem"
    />
    <div class="main">
      <ToolBar
        v-if="epub.isLoaded.value"
        :current-mode="epub.currentMode.value"
        :selected-color="epub.selectedColor.value"
        :selected-underline-style="epub.selectedUnderlineStyle.value"
        :underline-color="epub.underlineColor.value"
        :highlight-custom-color="epub.highlightCustomColor.value"
        :annotation-count="epub.annotationCount.value"
        @set-mode="epub.setAnnotationMode"
        @set-color="epub.setSelectedColor"
        @set-custom-color="epub.setCustomHighlightColor"
        @set-underline-style="(s: any) => epub.selectedUnderlineStyle.value = s"
        @set-underline-color="(c: string) => epub.underlineColor.value = c"
        @highlight="epub.highlight"
        @underline="epub.underline"
        @add-note="epub.addNote"
        @update-theme="epub.updateTheme"
        @set-font-family="epub.setFontFamily"
        @font-size-change="epub.setFontSize"
        @set-line-height="epub.setLineHeight"
        @switch-mode="onSwitchMode"
        @export="epub.exportAnnotations"
        @import="epub.importAnnotations"
        @clear="epub.clearAnnotations"
        @go-cfi="epub.goToCfi"
      />
      <ReaderView
        :is-loaded="epub.isLoaded.value"
        @viewer-mounted="setViewerRef"
      />
      <FooterBar
        v-if="epub.isLoaded.value"
        :current-mode="epub.currentMode.value"
        :progress-text="epub.progressText.value"
        @prev="epub.prev"
        @next="epub.next"
      />
    </div>
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
</style>
