<script setup lang="ts">
import { computed } from 'vue';
import {
  Setting,
  Download,
  UploadFilled,
  Delete,
  Location,
  RefreshLeft,
} from '@element-plus/icons-vue';
import type { Annotation } from 'epub-reader';

const props = defineProps<{
  annotationList: Annotation[];
  annotationCount: number;
  currentMode: 'paginated' | 'scrolled';
  themeName: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
}>();

const emit = defineEmits<{
  goToAnnotation: [annotation: Annotation];
  removeAnnotation: [id: string];
  exportAnnotations: [];
  importAnnotations: [];
  clearAnnotations: [];
  updateTheme: [name: string];
  setFontFamily: [family: string];
  setFontSize: [size: number];
  setLineHeight: [lh: number];
  switchMode: [mode: 'paginated' | 'scrolled'];
  resetTheme: [];
}>();

const highlights = computed(() =>
  props.annotationList.filter(a => a.type === 'highlight')
);
const underlines = computed(() =>
  props.annotationList.filter(a => a.type === 'underline')
);
const notes = computed(() =>
  props.annotationList.filter(a => a.type === 'note')
);

function getAnnotationText(a: Annotation): string {
  if ('anchor' in a) {
    return a.anchor.textContent || '(empty)';
  }
  return '(drawing)';
}

function getAnnotationColor(a: Annotation): string {
  if (a.type === 'highlight') {
    const c = a.color;
    if (typeof c === 'string') {
      const map: Record<string, string> = {
        yellow: '#FFEB3B', green: '#4CAF50', blue: '#2196F3',
        pink: '#E91E63', orange: '#FF9800',
      };
      return map[c] || c;
    }
    return c.custom;
  }
  if (a.type === 'underline' || a.type === 'note') return a.color;
  return '#999';
}

function truncate(text: string, max = 60): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}

const fontOptions = [
  { label: 'Default', value: '' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Courier', value: "'Courier New', monospace" },
  { label: 'YaHei', value: "'Microsoft YaHei', sans-serif" },
];
</script>

<template>
  <div class="right-panel">
    <el-tabs type="border-card" stretch>
      <!-- Annotations Tab -->
      <el-tab-pane>
        <template #label>
          <span>Annotations <el-badge :value="annotationCount" :max="99" type="info" /></span>
        </template>

        <div class="panel-actions">
          <el-button size="small" :icon="Download" @click="emit('exportAnnotations')">Export</el-button>
          <el-button size="small" :icon="UploadFilled" @click="emit('importAnnotations')">Import</el-button>
          <el-button size="small" type="danger" plain :icon="Delete" @click="emit('clearAnnotations')">Clear</el-button>
        </div>

        <el-scrollbar class="annotation-scroll">
          <!-- Highlights -->
          <div v-if="highlights.length" class="annotation-section">
            <div class="section-title">Highlights ({{ highlights.length }})</div>
            <div
              v-for="a in highlights"
              :key="a.id"
              class="annotation-item"
              @click="emit('goToAnnotation', a)"
            >
              <div class="annotation-color-bar" :style="{ background: getAnnotationColor(a) }" />
              <div class="annotation-content">
                <div class="annotation-text">{{ truncate(getAnnotationText(a)) }}</div>
                <div class="annotation-meta">Chapter {{ a.spineIndex + 1 }}</div>
              </div>
              <el-button
                class="annotation-delete"
                :icon="Delete"
                size="small"
                text
                type="danger"
                @click.stop="emit('removeAnnotation', a.id)"
              />
            </div>
          </div>

          <!-- Underlines -->
          <div v-if="underlines.length" class="annotation-section">
            <div class="section-title">Underlines ({{ underlines.length }})</div>
            <div
              v-for="a in underlines"
              :key="a.id"
              class="annotation-item"
              @click="emit('goToAnnotation', a)"
            >
              <div class="annotation-color-bar" :style="{ background: getAnnotationColor(a) }" />
              <div class="annotation-content">
                <div class="annotation-text">{{ truncate(getAnnotationText(a)) }}</div>
                <div class="annotation-meta">Chapter {{ a.spineIndex + 1 }}</div>
              </div>
              <el-button
                class="annotation-delete"
                :icon="Delete"
                size="small"
                text
                type="danger"
                @click.stop="emit('removeAnnotation', a.id)"
              />
            </div>
          </div>

          <!-- Notes -->
          <div v-if="notes.length" class="annotation-section">
            <div class="section-title">Notes ({{ notes.length }})</div>
            <div
              v-for="a in notes"
              :key="a.id"
              class="annotation-item"
              @click="emit('goToAnnotation', a)"
            >
              <div class="annotation-color-bar" :style="{ background: getAnnotationColor(a) }" />
              <div class="annotation-content">
                <div class="annotation-text">{{ truncate(getAnnotationText(a)) }}</div>
                <div v-if="a.type === 'note'" class="annotation-note">"{{ truncate(a.content, 40) }}"</div>
                <div class="annotation-meta">Chapter {{ a.spineIndex + 1 }}</div>
              </div>
              <el-button
                class="annotation-delete"
                :icon="Delete"
                size="small"
                text
                type="danger"
                @click.stop="emit('removeAnnotation', a.id)"
              />
            </div>
          </div>

          <el-empty v-if="!annotationCount" description="No annotations yet" :image-size="60" />
        </el-scrollbar>
      </el-tab-pane>

      <!-- Settings Tab -->
      <el-tab-pane>
        <template #label>
          <el-icon><Setting /></el-icon> Settings
        </template>

        <el-scrollbar class="settings-scroll">
          <div class="settings-section">
            <div class="setting-label">Reading Mode</div>
            <el-radio-group
              :model-value="currentMode"
              size="small"
              @change="(val: string | number | boolean | undefined) => emit('switchMode', val as 'paginated' | 'scrolled')"
            >
              <el-radio-button value="paginated">Paginated</el-radio-button>
              <el-radio-button value="scrolled">Scrolled</el-radio-button>
            </el-radio-group>
          </div>

          <el-divider />

          <div class="settings-section">
            <div class="setting-label">Theme</div>
            <el-radio-group
              :model-value="themeName"
              size="small"
              @change="(val: string | number | boolean | undefined) => emit('updateTheme', val as string)"
            >
              <el-radio-button value="light">Light</el-radio-button>
              <el-radio-button value="dark">Dark</el-radio-button>
              <el-radio-button value="sepia">Sepia</el-radio-button>
            </el-radio-group>
          </div>

          <el-divider />

          <div class="settings-section">
            <div class="setting-label">Font Family</div>
            <el-select
              :model-value="fontFamily"
              size="small"
              style="width: 100%;"
              @change="(val: string) => emit('setFontFamily', val)"
            >
              <el-option
                v-for="f in fontOptions"
                :key="f.value"
                :label="f.label"
                :value="f.value"
              />
            </el-select>
          </div>

          <el-divider />

          <div class="settings-section">
            <div class="setting-label">Font Size: {{ fontSize }}px</div>
            <el-slider
              :model-value="fontSize"
              :min="12"
              :max="32"
              :step="2"
              :show-tooltip="false"
              @input="(val: number | number[]) => emit('setFontSize', val as number)"
            />
          </div>

          <div class="settings-section">
            <div class="setting-label">Line Height: {{ lineHeight }}</div>
            <el-slider
              :model-value="lineHeight"
              :min="1.2"
              :max="3"
              :step="0.1"
              :show-tooltip="false"
              @input="(val: number | number[]) => emit('setLineHeight', val as number)"
            />
          </div>

          <el-divider />

          <div class="settings-section">
            <el-button :icon="RefreshLeft" style="width: 100%;" @click="emit('resetTheme')">
              Reset to Defaults
            </el-button>
          </div>
        </el-scrollbar>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style lang="scss" scoped>
.right-panel {
  width: 320px;
  background: #fff;
  border-left: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  :deep(.el-tabs) {
    height: 100%;
    display: flex;
    flex-direction: column;

    .el-tabs__content {
      flex: 1;
      overflow: hidden;
      padding: 0;

      .el-tab-pane {
        height: 100%;
        display: flex;
        flex-direction: column;
      }
    }
  }
}

.panel-actions {
  display: flex;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.annotation-scroll {
  flex: 1;
}

.annotation-section {
  padding: 8px 0;

  .section-title {
    font-size: 12px;
    font-weight: 600;
    color: #999;
    text-transform: uppercase;
    padding: 4px 12px 8px;
  }
}

.annotation-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: #f5f7fa;

    .annotation-delete {
      opacity: 1;
    }
  }

  .annotation-color-bar {
    width: 4px;
    min-height: 32px;
    border-radius: 2px;
    flex-shrink: 0;
    align-self: stretch;
  }

  .annotation-content {
    flex: 1;
    min-width: 0;
  }

  .annotation-text {
    font-size: 13px;
    color: #333;
    line-height: 1.4;
    word-break: break-word;
  }

  .annotation-note {
    font-size: 12px;
    color: #e6a23c;
    margin-top: 2px;
    font-style: italic;
  }

  .annotation-meta {
    font-size: 11px;
    color: #bbb;
    margin-top: 2px;
  }

  .annotation-delete {
    opacity: 0;
    flex-shrink: 0;
    transition: opacity 0.15s;
  }
}

.settings-scroll {
  flex: 1;
  padding: 12px;
}

.settings-section {
  .setting-label {
    font-size: 13px;
    color: #666;
    margin-bottom: 8px;
  }
}

:deep(.el-divider) {
  margin: 12px 0;
}
</style>
