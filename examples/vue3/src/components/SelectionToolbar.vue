<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import type { SelectionToolbarPosition, HighlightColor } from 'epub-reader';

const props = defineProps<{
  visible: boolean;
  position: SelectionToolbarPosition | null;
  selectedColor: HighlightColor;
}>();

const emit = defineEmits<{
  highlight: [];
  underline: [];
  addNote: [];
  copy: [];
  setColor: [color: HighlightColor];
}>();

const toolbarRef = ref<HTMLElement | null>(null);
const toolbarWidth = ref(0);
const toolbarHeight = ref(0);

const MARGIN = 8;
const OFFSET_Y = 10;

const colorPresets: { name: string; hex: string }[] = [
  { name: 'yellow', hex: '#FFEB3B' },
  { name: 'green', hex: '#4CAF50' },
  { name: 'blue', hex: '#2196F3' },
  { name: 'pink', hex: '#E91E63' },
];

function isColorActive(name: string): boolean {
  if (typeof props.selectedColor === 'string') {
    return props.selectedColor === name;
  }
  return false;
}

watch(() => props.visible, async (v) => {
  if (v) {
    await nextTick();
    if (toolbarRef.value) {
      const rect = toolbarRef.value.getBoundingClientRect();
      toolbarWidth.value = rect.width;
      toolbarHeight.value = rect.height;
    }
  }
});

const toolbarStyle = computed(() => {
  if (!props.position) return { display: 'none' };

  const { x, y, selectionRect } = props.position;
  const tw = toolbarWidth.value || 240;
  const th = toolbarHeight.value || 44;

  let left = x - tw / 2;
  left = Math.max(MARGIN, Math.min(left, window.innerWidth - tw - MARGIN));

  let top = y - th - OFFSET_Y;

  if (top < MARGIN) {
    top = selectionRect.bottom + OFFSET_Y;
  }

  return {
    position: 'fixed' as const,
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`,
    zIndex: 9999,
  };
});
</script>

<template>
  <Teleport to="body">
    <Transition name="sel-toolbar">
      <div
        v-if="visible && position"
        ref="toolbarRef"
        class="selection-toolbar"
        :style="toolbarStyle"
        @mousedown.prevent
      >
        <div class="toolbar-colors">
          <button
            v-for="c in colorPresets"
            :key="c.name"
            class="color-dot"
            :class="{ active: isColorActive(c.name) }"
            :style="{ background: c.hex }"
            :title="c.name"
            @mousedown.prevent="emit('setColor', c.name as any)"
          />
        </div>
        <span class="toolbar-sep" />
        <button class="toolbar-btn" title="高亮" @mousedown.prevent="emit('highlight')">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M15.24 2.47a1 1 0 0 1 1.41 0l4.88 4.88a1 1 0 0 1 0 1.41l-9.18 9.18a1 1 0 0 1-.7.3H7.12a1 1 0 0 1-.71-.3L2.47 13.99a1 1 0 0 1 0-1.41l12.77-10.11zm-.71 2.12L5.3 13.82l3.06 3.06h3.18l8.47-8.47-5.48-3.82zM2 20h20v2H2v-2z"/>
          </svg>
        </button>
        <button class="toolbar-btn" title="划线" @mousedown.prevent="emit('underline')">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"/>
          </svg>
        </button>
        <button class="toolbar-btn" title="笔记" @mousedown.prevent="emit('addNote')">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
          </svg>
        </button>
        <span class="toolbar-sep" />
        <button class="toolbar-btn" title="复制" @mousedown.prevent="emit('copy')">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
          </svg>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.selection-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15), 0 1px 4px rgba(0, 0, 0, 0.1);
  user-select: none;
}

.toolbar-colors {
  display: flex;
  align-items: center;
  gap: 4px;
}

.color-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  transition: border-color 0.15s, transform 0.15s;

  &:hover {
    transform: scale(1.15);
  }

  &.active {
    border-color: #333;
  }
}

.toolbar-sep {
  width: 1px;
  height: 20px;
  background: #e0e0e0;
  margin: 0 4px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: #555;
  padding: 0;
  transition: background-color 0.15s, color 0.15s;

  &:hover {
    background: #f0f0f0;
    color: #222;
  }

  &:active {
    background: #e0e0e0;
  }
}

// Transition
.sel-toolbar-enter-active,
.sel-toolbar-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.sel-toolbar-enter-from,
.sel-toolbar-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
