<template>
  <div class="modal" @click.self="$emit('close')" role="dialog" aria-modal="true" aria-label="分析密钥设置">
    <div class="modal-content">
      <div class="modal-header">
        <div>
          <p class="section-label">分析密钥设置</p>
          <h3>配置 AI 分析密钥</h3>
        </div>
        <button class="modal-close" @click="$emit('close')" aria-label="关闭">×</button>
      </div>
      <div class="form-group">
        <label class="form-label" for="api-key-input">分析密钥</label>
        <input id="api-key-input" :value="userApiKey" @input="$emit('update:userApiKey', $event.target.value)"
          type="password" class="form-input" placeholder="粘贴你的 API Key" />
        <small class="form-hint">密钥仅保存在你的浏览器中，不会上传到任何服务器。</small>
      </div>
      <div class="form-group">
        <label class="form-label" for="force-mode-select">调用模式</label>
        <select id="force-mode-select" class="form-select" :value="forceMode" @change="$emit('setForceMode', $event.target.value)">
          <option value="auto">自动：阿里云优先，失败时自动切本地</option>
          <option value="cloud">强制云端：仅用阿里云百炼</option>
          <option value="local">强制本地：仅用本地 Ollama</option>
        </select>
        <small class="form-hint">调试或对比效果时可手动指定；选择会自动保存到本地。</small>
      </div>
      <div class="settings-info">
        <h4>如何获取密钥</h4>
        <ol>
          <li>打开阿里云百炼控制台（bailian.console.aliyun.com）</li>
          <li>登录后点击右上角头像，选择「API-KEY」</li>
          <li>点击「创建新的 API-KEY」，复制后粘贴到上方输入框</li>
        </ol>
      </div>
      <div class="form-buttons">
        <button class="btn btn-plain danger" @click="$emit('clearApiKey')">清除密钥</button>
        <button class="btn btn-primary" @click="$emit('saveApiKey')">保存密钥</button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({ userApiKey: String, forceMode: String })
defineEmits(['close', 'saveApiKey', 'clearApiKey', 'setForceMode', 'update:userApiKey'])
</script>
