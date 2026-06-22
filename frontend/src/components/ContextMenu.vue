<template>
  <div class="context-menu" :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }" role="menu" @click.stop>
    <div class="context-menu-header">{{ contextMenu.node && contextMenu.node.name }}</div>
    <button class="context-item" @click="$emit('contextEditNode')">编辑…</button>
    <div class="context-divider"></div>
    <button class="context-item" @click="$emit('contextAddChild', 'male')">添加儿子</button>
    <button class="context-item" @click="$emit('contextAddChild', 'female')">添加女儿</button>
    <button class="context-item" @click="$emit('contextAddSpouse')">添加配偶</button>
    <div class="context-divider"></div>
    <button class="context-item" @click="$emit('contextAddParent', 'father')">添加父亲</button>
    <button class="context-item" @click="$emit('contextAddParent', 'mother')">添加母亲</button>
    <div class="context-divider"></div>
    <button class="context-item" @click="$emit('setAsRootNode')">设为根</button>
    <button class="context-item danger" @click="$emit('contextDeleteNode')">删除</button>
  </div>
</template>

<script setup>
defineProps({ contextMenu: Object })
defineEmits([
  'contextEditNode', 'contextAddChild', 'contextAddSpouse',
  'contextAddParent', 'setAsRootNode', 'contextDeleteNode',
])
</script>
