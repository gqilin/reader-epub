<script setup lang="ts">
import { provide, ref } from 'vue';
import SideBar from '../components/SideBar.vue';
import ToolBar from '../components/ToolBar.vue';
import ReaderView from '../components/ReaderView.vue';
import FooterBar from '../components/FooterBar.vue';
import RightPanel from '../components/RightPanel.vue';
import SelectionToolbar from '../components/SelectionToolbar.vue';
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
      :active-toc-id="epub.activeTocId.value"
      @load-file="onFileLoaded"
      @toc-click="epub.goToTocItem"
    />
    <div class="main">
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
    <RightPanel
      v-if="epub.isLoaded.value"
      :annotation-list="epub.annotationList.value"
      :annotation-count="epub.annotationCount.value"
      :current-mode="epub.currentMode.value"
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
