<template>
  <header class="topbar">
    <div class="brand">
      <div class="brand-seal">谱</div>
      <div>
        <p class="brand-kicker">智能谱牒工作台</p>
        <h1>族谱生成器</h1>
      </div>
    </div>

    <div class="topbar-actions">
      <span
        v-if="providerBadge"
        :class="['provider-badge', `tone-${providerBadge.tone}`]"
        :title="providerBadge.hint || providerBadge.text"
        aria-live="polite"
      >{{ providerBadge.text }}</span>
      <button class="btn btn-icon" @click="$emit('undo')" :disabled="!canUndo" aria-label="撤销 (Ctrl+Z)" title="撤销 (Ctrl+Z)">↶</button>
      <button class="btn btn-icon" @click="$emit('redo')" :disabled="!canRedo" aria-label="重做 (Ctrl+Y)" title="重做 (Ctrl+Y)">↷</button>
      <span class="toolbar-sep"></span>
      <button class="btn btn-primary" @click="$emit('triggerFileUpload')" :disabled="isLoading" aria-label="上传文档">
        {{ isLoading ? '分析中' : '上传文档' }}
      </button>
      <button class="btn btn-plain" @click="$emit('openSearch')" :disabled="!hasData" aria-label="搜索人物 (Ctrl+K)" title="搜索人物 (Ctrl+K)">搜索人物</button>
      <button class="btn btn-plain" @click="$emit('exportImage')" :disabled="!hasData || isLoading" aria-label="导出图片">导出图片</button>
      <button class="btn btn-plain" @click="$emit('exportGedcom')" :disabled="!hasData || isLoading" aria-label="导出 GEDCOM">导出 GEDCOM</button>
      <button class="btn btn-plain" @click="$emit('toggleTheme')" :aria-label="'切换到' + (theme === 'dark' ? '亮色' : '暗色') + '模式'" :title="'切换到' + (theme === 'dark' ? '亮色' : '暗色') + '模式'">
        {{ theme === 'dark' ? '☀ 亮色' : '🌙 暗色' }}
      </button>
      <button class="btn btn-plain" @click="$emit('showHelp')" aria-label="快捷键帮助" title="快捷键帮助 (?)">?</button>
      <button class="btn btn-plain" @click="$emit('clearAll')" :disabled="!hasData || isLoading" aria-label="清空族谱">清空</button>
      <button class="btn btn-plain" @click="$emit('showSettings')" aria-label="打开设置">设置</button>
    </div>
  </header>
</template>

<script setup>
defineProps({
  isLoading: Boolean,
  hasData: Boolean,
  providerBadge: Object,
  canUndo: Boolean,
  canRedo: Boolean,
  theme: String,
})

defineEmits([
  'triggerFileUpload', 'openSearch', 'exportImage', 'exportGedcom',
  'toggleTheme', 'showHelp', 'clearAll', 'showSettings', 'undo', 'redo',
])
</script>
