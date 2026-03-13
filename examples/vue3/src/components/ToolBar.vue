<script setup lang="ts">
import { ref } from 'vue';
import {
  Pointer,
  EditPen,
  View,
} from '@element-plus/icons-vue';
import type { HighlightColor, UnderlineStyle } from 'epub-reader';

defineProps<{
  selectedColor: HighlightColor;
  selectedUnderlineStyle: UnderlineStyle;
  underlineColor: string;
  highlightCustomColor: string;
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
  goCfi: [cfi: string];
}>();

const activeAnnotationMode = ref<'select' | 'draw' | 'view'>('select');
const activeColorName = ref<string>('yellow');
const cfiInput = ref('');
const underlineStyleValue = ref<UnderlineStyle>('solid');

function setAnnotationMode(mode: 'select' | 'draw' | 'view') {
  activeAnnotationMode.value = mode;
  emit('setMode', mode);
}

function selectPresetColor(name: string) {
  activeColorName.value = name;
  emit('setColor', name as HighlightColor);
}

function onUnderlineStyleChange(val: string) {
  underlineStyleValue.value = val as UnderlineStyle;
  emit('setUnderlineStyle', val as UnderlineStyle);
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
        <el-button :type="activeAnnotationMode === 'select' ? 'primary' : ''" :icon="Pointer" @click="setAnnotationMode('select')">Select</el-button>
        <el-button :type="activeAnnotationMode === 'draw' ? 'primary' : ''" :icon="EditPen" @click="setAnnotationMode('draw')">Draw</el-button>
        <el-button :type="activeAnnotationMode === 'view' ? 'primary' : ''" :icon="View" @click="setAnnotationMode('view')">View</el-button>
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
