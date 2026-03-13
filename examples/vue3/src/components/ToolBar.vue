<script setup lang="ts">
import { ref } from 'vue';
import {
  Pointer,
  EditPen,
  View,
  Download,
  UploadFilled,
  Delete,
  ArrowLeft,
  ArrowRight,
} from '@element-plus/icons-vue';
import type { HighlightColor, UnderlineStyle } from 'epub-reader';

defineProps<{
  currentMode: 'paginated' | 'scrolled';
  selectedColor: HighlightColor;
  selectedUnderlineStyle: UnderlineStyle;
  underlineColor: string;
  highlightCustomColor: string;
  annotationCount: number;
}>();

const emit = defineEmits<{
  setMode: [mode: 'select' | 'draw' | 'view'];
  setColor: [color: HighlightColor];
  setCustomColor: [hex: string];
  setUnderlineStyle: [style: UnderlineStyle];
  setUnderlineColor: [color: string];
  highlight: [];
  underline: [];
  addNote: [];
  updateTheme: [name: string];
  setFontFamily: [family: string];
  fontSizeChange: [delta: number];
  setLineHeight: [lh: number];
  switchMode: [mode: 'paginated' | 'scrolled'];
  export: [];
  import: [];
  clear: [];
  goCfi: [cfi: string];
}>();

const activeAnnotationMode = ref<'select' | 'draw' | 'view'>('select');
const activeColorName = ref<string>('yellow');
const cfiInput = ref('');
const themeValue = ref('light');
const fontValue = ref('');
const lineHeightValue = ref('1.8');
const underlineStyleValue = ref<UnderlineStyle>('solid');

function setAnnotationMode(mode: 'select' | 'draw' | 'view') {
  activeAnnotationMode.value = mode;
  emit('setMode', mode);
}

function selectPresetColor(name: string) {
  activeColorName.value = name;
  emit('setColor', name as HighlightColor);
}

function onCustomColor(e: Event) {
  const hex = (e.target as HTMLInputElement).value;
  activeColorName.value = '';
  emit('setCustomColor', hex);
}

function onUnderlineStyleChange(val: string) {
  underlineStyleValue.value = val as UnderlineStyle;
  emit('setUnderlineStyle', val as UnderlineStyle);
}

function onThemeChange(val: string) {
  themeValue.value = val;
  emit('updateTheme', val);
}

function onFontChange(val: string) {
  fontValue.value = val;
  emit('setFontFamily', val);
}

function onLineHeightChange(val: string) {
  lineHeightValue.value = val;
  emit('setLineHeight', parseFloat(val));
}

function onGoToCfi() {
  const cfi = cfiInput.value.trim();
  if (cfi) emit('goCfi', cfi);
}

const colorPresets = [
  { name: 'yellow', hex: '#FFEB3B' },
  { name: 'green', hex: '#4CAF50' },
  { name: 'blue', hex: '#2196F3' },
  { name: 'pink', hex: '#E91E63' },
];
</script>

<template>
  <div class="toolbar">
    <!-- Annotation mode -->
    <div class="toolbar-group">
      <span class="group-label">Mode:</span>
      <el-button-group size="small">
        <el-button :type="activeAnnotationMode === 'select' ? 'primary' : ''" :icon="Pointer" @click="setAnnotationMode('select')">
          Select
        </el-button>
        <el-button :type="activeAnnotationMode === 'draw' ? 'primary' : ''" :icon="EditPen" @click="setAnnotationMode('draw')">
          Draw
        </el-button>
        <el-button :type="activeAnnotationMode === 'view' ? 'primary' : ''" :icon="View" @click="setAnnotationMode('view')">
          View
        </el-button>
      </el-button-group>
    </div>

    <el-divider direction="vertical" />

    <!-- Highlight colors -->
    <div class="toolbar-group">
      <span class="group-label">Highlight:</span>
      <div class="color-buttons">
        <button
          v-for="c in colorPresets"
          :key="c.name"
          class="color-btn"
          :class="{ active: activeColorName === c.name }"
          :style="{ background: c.hex }"
          @click="selectPresetColor(c.name)"
        />
        <el-color-picker
          :model-value="highlightCustomColor"
          size="small"
          @change="(val: string | null) => { if (val) { activeColorName = ''; emit('setCustomColor', val); } }"
        />
      </div>
    </div>

    <el-divider direction="vertical" />

    <!-- Underline -->
    <div class="toolbar-group">
      <span class="group-label">Line:</span>
      <el-select v-model="underlineStyleValue" size="small" style="width: 120px;" @change="onUnderlineStyleChange">
        <el-option label="Solid" value="solid" />
        <el-option label="Dashed" value="dashed" />
        <el-option label="Wavy" value="wavy" />
        <el-option label="Strikethrough" value="strikethrough" />
      </el-select>
      <el-color-picker
        :model-value="underlineColor"
        size="small"
        @change="(val: string | null) => { if (val) emit('setUnderlineColor', val); }"
      />
    </div>

    <el-divider direction="vertical" />

    <!-- Annotation actions -->
    <div class="toolbar-group">
      <el-button size="small" type="warning" @click="emit('highlight')">Highlight</el-button>
      <el-button size="small" type="danger" @click="emit('underline')">Underline</el-button>
      <el-button size="small" type="info" @click="emit('addNote')">Note</el-button>
    </div>

    <el-divider direction="vertical" />

    <!-- Theme / Font -->
    <div class="toolbar-group">
      <span class="group-label">Theme:</span>
      <el-select v-model="themeValue" size="small" style="width: 90px;" @change="onThemeChange">
        <el-option label="Light" value="light" />
        <el-option label="Dark" value="dark" />
        <el-option label="Sepia" value="sepia" />
      </el-select>
    </div>

    <div class="toolbar-group">
      <span class="group-label">Font:</span>
      <el-select v-model="fontValue" size="small" style="width: 110px;" @change="onFontChange">
        <el-option label="Default" value="" />
        <el-option label="Georgia" value="Georgia, serif" />
        <el-option label="Courier" value="'Courier New', monospace" />
        <el-option label="YaHei" value="'Microsoft YaHei', sans-serif" />
      </el-select>
      <el-button-group size="small">
        <el-button @click="emit('fontSizeChange', -2)">A-</el-button>
        <el-button @click="emit('fontSizeChange', 2)">A+</el-button>
      </el-button-group>
    </div>

    <div class="toolbar-group">
      <span class="group-label">Line:</span>
      <el-select v-model="lineHeightValue" size="small" style="width: 75px;" @change="onLineHeightChange">
        <el-option label="1.5" value="1.5" />
        <el-option label="1.8" value="1.8" />
        <el-option label="2.0" value="2" />
        <el-option label="2.5" value="2.5" />
      </el-select>
    </div>

    <el-divider direction="vertical" />

    <!-- Reading mode -->
    <div class="toolbar-group">
      <span class="group-label">Reading:</span>
      <el-button-group size="small">
        <el-button :type="currentMode === 'paginated' ? 'primary' : ''" @click="emit('switchMode', 'paginated')">
          Paginated
        </el-button>
        <el-button :type="currentMode === 'scrolled' ? 'primary' : ''" @click="emit('switchMode', 'scrolled')">
          Scrolled
        </el-button>
      </el-button-group>
    </div>

    <el-divider direction="vertical" />

    <!-- Annotation management -->
    <div class="toolbar-group">
      <el-button size="small" :icon="Download" @click="emit('export')">Export</el-button>
      <el-button size="small" :icon="UploadFilled" @click="emit('import')">Import</el-button>
      <el-button size="small" type="danger" plain :icon="Delete" @click="emit('clear')">Clear</el-button>
      <el-tag size="small" type="info">{{ annotationCount }}</el-tag>
    </div>

    <el-divider direction="vertical" />

    <!-- CFI navigation -->
    <div class="toolbar-group">
      <span class="group-label">CFI:</span>
      <el-input
        v-model="cfiInput"
        size="small"
        placeholder="epubcfi(...)"
        style="width: 200px;"
        @keyup.enter="onGoToCfi"
      />
      <el-button size="small" type="primary" @click="onGoToCfi">Go</el-button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.toolbar {
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  .el-divider--vertical {
    height: 20px;
    margin: 0 4px;
  }
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 6px;

  .group-label {
    font-size: 12px;
    color: #666;
    white-space: nowrap;
  }
}

.color-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}

.color-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  transition: border-color 0.15s;

  &.active {
    border-color: #333;
  }

  &:hover {
    border-color: #999;
  }
}
</style>
