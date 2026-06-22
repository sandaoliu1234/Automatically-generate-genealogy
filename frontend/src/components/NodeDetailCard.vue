<template>
  <transition name="slide-in">
    <aside v-if="detail.isDetailOpen.value && detail.detailNode.value" class="node-detail-drawer" role="complementary" aria-label="成员详情">
      <header class="detail-header">
        <p class="section-label">人物详情</p>
        <button class="modal-close" @click="detail.closeNodeDetail" aria-label="关闭">×</button>
      </header>

      <div class="detail-hero">
        <div class="detail-avatar" :class="{ female: detail.detailNode.value.gender === 'female' }">
          <img v-if="detail.detailNode.value.avatar" :src="getAvatarUrl(detail.detailNode.value)" :alt="detail.detailNode.value.name" />
          <span v-else>{{ (detail.detailNode.value.name || '?').slice(0, 1) }}</span>
        </div>
        <div class="detail-identity">
          <h3 class="detail-name">{{ detail.detailNode.value.name }}</h3>
          <p class="detail-meta">
            <span>{{ detail.detailNode.value.gender === 'female' ? '女' : '男' }}</span>
            <span>·</span>
            <span>第 {{ detail.detailNode.value.generation || 1 }} 代</span>
          </p>
        </div>
      </div>

      <section class="detail-section">
        <p class="detail-section-title">生平</p>
        <div class="detail-row">
          <span class="detail-label">生</span>
          <span class="detail-value">{{ detail.detailNode.value.birth || '—' }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">卒</span>
          <span class="detail-value">{{ detail.detailNode.value.death || '—' }}</span>
        </div>
        <div v-if="detail.detailNode.value.note" class="detail-note">{{ detail.detailNode.value.note }}</div>
      </section>

      <section class="detail-section">
        <p class="detail-section-title">关系</p>
        <div class="detail-rel-block">
          <p class="detail-rel-label">父母</p>
          <div v-if="detail.detailFather.value || detail.detailMother.value" class="detail-rel-list">
            <button v-if="detail.detailFather.value" class="detail-rel-chip" @click="detail.navigateToNode(detail.detailFather.value)">
              <span class="chip-gender male">父</span>{{ detail.detailFather.value.name }}
            </button>
            <button v-if="detail.detailMother.value" class="detail-rel-chip" @click="detail.navigateToNode(detail.detailMother.value)">
              <span class="chip-gender female">母</span>{{ detail.detailMother.value.name }}
            </button>
          </div>
          <p v-else class="detail-empty">—</p>
        </div>

        <div class="detail-rel-block">
          <p class="detail-rel-label">配偶</p>
          <div v-if="detail.detailSpouses.value.length" class="detail-rel-list">
            <button v-for="s in detail.detailSpouses.value" :key="s.id" class="detail-rel-chip" @click="detail.navigateToNode(s)">
              <span :class="['chip-gender', s.gender === 'female' ? 'female' : 'male']">{{ s.gender === 'female' ? '妻' : '夫' }}</span>{{ s.name }}
            </button>
          </div>
          <p v-else class="detail-empty">—</p>
        </div>

        <div class="detail-rel-block">
          <p class="detail-rel-label">子女 <span class="detail-count">{{ detail.detailChildren.value.length }}</span></p>
          <div v-if="detail.detailChildren.value.length" class="detail-rel-list">
            <button v-for="c in detail.detailChildren.value" :key="c.id" class="detail-rel-chip" @click="detail.navigateToNode(c)">
              <span :class="['chip-gender', c.gender === 'female' ? 'female' : 'male']">{{ c.gender === 'female' ? '女' : '子' }}</span>{{ c.name }}
            </button>
          </div>
          <p v-else class="detail-empty">—</p>
        </div>

        <div v-if="detail.detailSiblings.value.length" class="detail-rel-block">
          <p class="detail-rel-label">兄弟姐妹 <span class="detail-count">{{ detail.detailSiblings.value.length }}</span></p>
          <div class="detail-rel-list">
            <button v-for="sb in detail.detailSiblings.value" :key="sb.id" class="detail-rel-chip" @click="detail.navigateToNode(sb)">
              <span :class="['chip-gender', sb.gender === 'female' ? 'female' : 'male']">{{ sb.gender === 'female' ? '姐/妹' : '兄/弟' }}</span>{{ sb.name }}
            </button>
          </div>
        </div>
      </section>

      <footer class="detail-footer">
        <button class="btn btn-primary detail-edit-btn" @click="onEdit">编辑成员</button>
      </footer>
    </aside>
  </transition>
</template>

<script setup>
import { useNodeDetail } from '../composables/useNodeDetail'
import { useNodeOperations } from '../composables/useNodeOperations'
import { getAvatarUrl } from '../utils/defaultAvatars.js'

const detail = useNodeDetail()
const nodeOps = useNodeOperations()

// "编辑成员" 按钮：先关详情卡，再开编辑模态框
const onEdit = () => {
  const node = detail.detailNode.value
  if (!node) return
  detail.closeNodeDetail()
  nodeOps.editNode(node)
}
</script>
