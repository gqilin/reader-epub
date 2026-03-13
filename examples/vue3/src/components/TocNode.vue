<script setup lang="ts">
import type { TocItem } from 'epub-reader';

const props = defineProps<{
  item: TocItem;
  level: number;
  activeTocId: string;
}>();

const emit = defineEmits<{
  clickItem: [item: TocItem];
}>();

function onClick() {
  emit('clickItem', props.item);
}

function onChildClick(child: TocItem) {
  emit('clickItem', child);
}
</script>

<template>
  <div>
    <div
      class="toc-item"
      :class="{ nested: level > 0, active: item.id === activeTocId }"
      :style="{ paddingLeft: (16 + level * 16) + 'px' }"
      @click="onClick"
    >
      {{ item.label }}
    </div>
    <template v-if="item.children && item.children.length > 0">
      <TocNode
        v-for="child in item.children"
        :key="child.label"
        :item="child"
        :level="level + 1"
        :active-toc-id="activeTocId"
        @click-item="onChildClick"
      />
    </template>
  </div>
</template>

<style lang="scss" scoped>
.toc-item {
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  color: #333;
  border-left: 3px solid transparent;
  transition: all 0.15s;

  &:hover {
    background: #f0f0f0;
  }

  &.active {
    background: #e8f0fe;
    border-left-color: var(--el-color-primary);
    color: var(--el-color-primary);
  }

  &.nested {
    font-size: 12px;
  }
}
</style>
