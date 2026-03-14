<script setup lang="ts">
import { watch, ref } from 'vue';

const props = defineProps<{
  visible: boolean;
  source: 'new' | 'edit';
  content: string;
}>();

const emit = defineEmits<{
  confirm: [content: string];
  cancel: [];
}>();

const inputContent = ref('');

watch(() => props.visible, (v) => {
  if (v) {
    inputContent.value = props.content;
  }
});

function handleConfirm() {
  emit('confirm', inputContent.value);
}

function handleCancel() {
  emit('cancel');
}
</script>

<template>
  <Teleport to="body">
    <Transition name="note-dialog">
      <div v-if="visible" class="note-dialog-overlay" @click="handleCancel">
        <div class="note-dialog" @click.stop>
          <div class="note-dialog-header">
            <h2>{{ source === 'new' ? '添加笔记' : '编辑笔记' }}</h2>
            <button class="close-btn" @click="handleCancel">✕</button>
          </div>
          <div class="note-dialog-body">
            <textarea
              v-model="inputContent"
              class="note-input"
              :placeholder="source === 'new' ? '输入笔记内容...' : '编辑笔记内容...'"
              @keydown.ctrl.enter="handleConfirm"
              @keydown.meta.enter="handleConfirm"
            />
          </div>
          <div class="note-dialog-footer">
            <button class="btn btn-cancel" @click="handleCancel">取消</button>
            <button class="btn btn-confirm" @click="handleConfirm">
              {{ source === 'new' ? '添加' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style lang="scss" scoped>
.note-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.note-dialog {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  width: 90%;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.note-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 500;
    color: #333;
  }
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #999;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background-color 0.15s, color 0.15s;

  &:hover {
    background: #f5f5f5;
    color: #333;
  }
}

.note-dialog-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.note-input {
  width: 100%;
  height: 200px;
  padding: 12px;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  transition: border-color 0.15s;

  &:focus {
    outline: none;
    border-color: #409eff;
    box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.1);
  }
}

.note-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #e0e0e0;
  background: #fafafa;
  border-radius: 0 0 8px 8px;
}

.btn {
  padding: 8px 24px;
  border-radius: 4px;
  border: 1px solid #d0d0d0;
  background: #fff;
  color: #333;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: #b0b0b0;
    color: #222;
  }

  &:active {
    background: #f5f5f5;
  }
}

.btn-confirm {
  background: #409eff;
  color: #fff;
  border-color: #409eff;

  &:hover {
    background: #66b1ff;
    border-color: #66b1ff;
  }

  &:active {
    background: #0d6cdb;
  }
}

.btn-cancel {
  &:hover {
    border-color: #d0d0d0;
  }
}

// Transition
.note-dialog-enter-active,
.note-dialog-leave-active {
  transition: opacity 0.15s ease;

  .note-dialog {
    transition: transform 0.15s ease;
  }
}

.note-dialog-enter-from,
.note-dialog-leave-to {
  opacity: 0;

  .note-dialog {
    transform: scale(0.95);
  }
}
</style>
