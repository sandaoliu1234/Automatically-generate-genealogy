<template>
  <div class="modal" @click.self="$emit('close')" role="dialog" aria-modal="true" aria-label="成员编辑">
    <div class="modal-content compact">
      <div class="modal-header">
        <div>
          <p class="section-label">成员编辑</p>
          <h3>调整族谱成员</h3>
        </div>
        <button class="modal-close" @click="$emit('close')" aria-label="关闭">×</button>
      </div>

      <!-- Avatar upload section -->
      <div class="avatar-upload-section">
        <div class="avatar-preview-wrapper" @click="triggerAvatarUpload" title="点击上传头像">
          <img :src="avatarPreviewUrl" class="avatar-preview" alt="头像预览" />
          <div class="avatar-overlay">
            <span>更换</span>
          </div>
        </div>
        <input ref="avatarInput" type="file" accept="image/jpeg,image/png,image/gif,image/webp" class="upload-input" @change="handleAvatarChange" />
        <div class="avatar-actions">
          <button class="btn btn-sm btn-plain" @click="triggerAvatarUpload">上传头像</button>
          <button v-if="editingNode.avatar" class="btn btn-sm btn-plain danger" @click="removeAvatar">移除</button>
        </div>
        <p v-if="avatarError" class="avatar-error">{{ avatarError }}</p>
      </div>

      <div class="form-group">
        <label class="form-label" for="edit-name">姓名</label>
        <input id="edit-name" v-model="editingNode.name" class="form-input" placeholder="输入姓名" maxlength="50" @keyup.enter="$emit('save')" autofocus />
      </div>
      <div class="form-group">
        <label class="form-label" for="edit-gender">性别</label>
        <select id="edit-gender" v-model="editingNode.gender" class="form-select">
          <option value="male">男</option>
          <option value="female">女</option>
        </select>
      </div>
      <div class="form-row-2col">
        <div class="form-group">
          <label class="form-label" for="edit-birth">出生日期</label>
          <input id="edit-birth" v-model="editingNode.birth" class="form-input" placeholder="如 1920-03-15" @keyup.enter="$emit('save')" />
        </div>
        <div class="form-group">
          <label class="form-label" for="edit-death">死亡日期</label>
          <input id="edit-death" v-model="editingNode.death" class="form-input" placeholder="如 1995-08-22" @keyup.enter="$emit('save')" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="edit-note">备注</label>
        <input id="edit-note" v-model="editingNode.note" class="form-input" placeholder="可选，填写补充说明" @keyup.enter="$emit('save')" />
      </div>
      <div class="form-buttons">
        <button class="btn btn-plain danger" @click="$emit('delete', editingNode)">删除成员</button>
        <button class="btn btn-primary" @click="$emit('save')">保存修改</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { getAvatarUrl } from '../utils/defaultAvatars.js'

const props = defineProps({ editingNode: Object })
const emit = defineEmits(['close', 'save', 'delete'])

const avatarInput = ref(null)
const avatarError = ref('')

// 头像预览 URL：优先使用已上传的 avatar，否则使用默认头像
const avatarPreviewUrl = computed(() => getAvatarUrl(props.editingNode))

const triggerAvatarUpload = () => {
  avatarInput.value?.click()
}

const handleAvatarChange = async (event) => {
  avatarError.value = ''
  const file = event.target.files?.[0]
  if (!file) return
  event.target.value = ''

  // 校验文件大小 (2MB)
  if (file.size > 2 * 1024 * 1024) {
    avatarError.value = '图片大小不能超过 2MB'
    return
  }

  try {
    const formData = new FormData()
    formData.append('avatar', file)
    const res = await fetch('/api/avatar/upload', { method: 'POST', body: formData })
    const json = await res.json()
    if (json.success) {
      // 直接更新 editingNode 的 avatar 字段（响应式）
      props.editingNode.avatar = json.data.path
    } else {
      avatarError.value = json.error?.message || '头像上传失败'
    }
  } catch (err) {
    avatarError.value = '头像上传失败，请检查后端服务'
  }
}

const removeAvatar = () => {
  // 删除服务器上的头像文件
  if (props.editingNode.avatar) {
    const filename = props.editingNode.avatar.split('/').pop()
    fetch(`/api/avatar/${filename}`, { method: 'DELETE' }).catch(() => {})
  }
  props.editingNode.avatar = ''
}
</script>
