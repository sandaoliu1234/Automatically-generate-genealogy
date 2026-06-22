/**
 * 默认头像工具
 * 提供男/女默认头像 SVG data URI，以及头像 URL 解析函数
 */

// 男性默认头像：深棕色背景 + 男性剪影
export const DEFAULT_MALE_AVATAR = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="40" fill="#5a3a2a"/>
  <circle cx="40" cy="28" r="14" fill="#d4b896"/>
  <ellipse cx="40" cy="62" rx="22" ry="18" fill="#d4b896"/>
</svg>`)}`

// 女性默认头像：玫瑰色背景 + 女性剪影
export const DEFAULT_FEMALE_AVATAR = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
  <rect width="80" height="80" rx="40" fill="#6b3a4a"/>
  <circle cx="40" cy="28" r="14" fill="#e8c4d0"/>
  <ellipse cx="40" cy="62" rx="22" ry="18" fill="#e8c4d0"/>
</svg>`)}`

/**
 * 获取节点的头像 URL
 * - 如果有自定义头像路径，拼上前端代理地址
 * - 否则根据性别返回默认头像
 * @param {Object} node - 节点对象 { avatar, gender, ... }
 * @returns {string} 头像 URL
 */
export function getAvatarUrl(node) {
  if (node.avatar) {
    // avatar 存储为相对路径如 /uploads/avatars/xxx.jpg
    return node.avatar
  }
  return node.gender === 'female' ? DEFAULT_FEMALE_AVATAR : DEFAULT_MALE_AVATAR
}
