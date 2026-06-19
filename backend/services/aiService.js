const axios = require('axios');

// 主调用失败时，可触发兜底切换的 HTTP 状态码（401/403/402=鉴权/余额，408/429=超时/限流，5xx=服务端故障）
const FALLBACK_STATUS_CODES = new Set([401, 402, 403, 408, 429, 500, 502, 503, 504]);
// 网络层错误码：连接被拒、DNS 失败、超时等
const FALLBACK_NETWORK_CODES = new Set(['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNRESET', 'EAI_AGAIN']);

class AIService {
  constructor() {
    // 主调用：阿里云百炼（OpenAI 兼容）
    this.endpoint = process.env.AI_ENDPOINT || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    this.model = process.env.AI_MODEL || 'qwen-plus';
    this.defaultApiKey = process.env.API_KEY;
    // 兜底：本地 Ollama（OpenAI 兼容）
    this.fallbackEndpoint = process.env.FALLBACK_ENDPOINT || 'http://localhost:11434/v1';
    this.fallbackModel = process.env.FALLBACK_MODEL || 'qwen2.5:3b';
    this.fallbackIsLocal = /localhost|127\.0\.0\.1|::1|0\.0\.0\.0/i.test(this.fallbackEndpoint);
  }

  async analyzeDocument(content, userApiKey = null, force = 'auto') {
    const primaryKey = userApiKey || this.defaultApiKey;

    // 主调用参数
    const primary = {
      label: '阿里云百炼',
      endpoint: this.endpoint,
      model: this.model,
      apiKey: primaryKey,
      isLocal: false
    };
    // 兜底参数
    const fallback = {
      label: '本地 Ollama',
      endpoint: this.fallbackEndpoint,
      model: this.fallbackModel,
      apiKey: null,
      isLocal: this.fallbackIsLocal
    };

    // 强制本地：跳过主调用，直接走兜底
    if (force === 'local') {
      const result = await this.callProvider(fallback, content);
      result.provider = fallback.label;
      result.forced = 'local';
      return result;
    }

    // 1) 优先主调用
    try {
      const result = await this.callProvider(primary, content);
      if (force === 'cloud') result.forced = 'cloud';
      return result;
    } catch (err) {
      // 强制云端：失败不再兜底
      if (force === 'cloud') throw err;
      if (!this.shouldFallback(err)) {
        throw err;
      }
      console.warn(
        `[AI] 主调用(${primary.label})失败，自动切换到兜底(${fallback.label})。原因: ${err.message}`
      );
    }

    // 2) 兜底：本地 Ollama
    const result = await this.callProvider(fallback, content);
    result.provider = fallback.label;
    result.fallback = true;
    result.primaryError = this.lastPrimaryError;
    return result;
  }

  // 判断错误是否应该触发兜底切换
  shouldFallback(err) {
    if (!err) return false;
    if (err.code && FALLBACK_NETWORK_CODES.has(err.code)) return true;
    const status = err.response?.status;
    if (!status) {
      // axios 未拿到 HTTP 响应（如 ECONNREFUSED / 超时已被上面捕获），
      // 兜底也无意义（本地连不上）。仅在 primary 非本地时再做一次兜底尝试。
      return true;
    }
    return FALLBACK_STATUS_CODES.has(status);
  }

  // 统一调用任一 OpenAI 兼容提供方
  async callProvider(opts, content) {
    const { label, endpoint, model, apiKey, isLocal } = opts;

    if (!isLocal && (!apiKey || apiKey.trim() === '')) {
      throw new Error(`未配置 ${label} 的 API Key`);
    }

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey && apiKey.trim() !== '') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    try {
      const response = await axios.post(
        `${endpoint}/chat/completions`,
        {
          model,
          messages: [
            { role: 'system', content: this.getSystemPrompt() },
            { role: 'user', content: this.buildPrompt(content) }
          ],
          temperature: 0.3,
          max_tokens: 2000
        },
        { headers, timeout: 60000 }
      );

      const choice = response.data?.choices?.[0];
      const aiContent = choice?.message?.content;
      if (!aiContent) {
        const reason = response.data?.error?.message
          || (isLocal ? '本地模型未返回内容，请确认 ollama 进程已启动且模型已拉取（ollama pull qwen2.5:3b）' : 'AI 未返回有效内容（可能余额不足、限流或模型不可用）');
        throw new Error(reason);
      }
      console.log(`[${label}] AI原始响应:`, aiContent);

      const parsed = this.parseAIResponse(aiContent);
      parsed.provider = label;
      return parsed;

    } catch (error) {
      const status = error.response?.status;
      const errMsg = error.response?.data?.error?.message || error.message;
      const wrapped = new Error(`${label} 调用失败: ${errMsg}${status ? ` (HTTP ${status})` : ''}`);
      wrapped.code = error.code;
      wrapped.response = error.response;
      // 记录最近一次主调用错误，便于前端展示
      if (label === '阿里云百炼') this.lastPrimaryError = wrapped.message;
      throw wrapped;
    }
  }

  getSystemPrompt() {
    return `你是一个专业的族谱分析助手。你的任务是从文本中提取家族成员及其直系亲属关系。

重要规则：
1. 只识别直系亲属关系：父母、子女、配偶
2. 不识别旁系亲属：叔伯、姑妈、姨妈、舅舅、堂兄妹、表兄妹等
3. 不允许跨代直接连接：孙子不能直接连接爷爷，必须通过父亲连接
4. 每个成员需要有代数(generation)信息，第1代是最早的祖先

返回格式必须是严格的JSON：
{
  "members": [
    {"name": "姓名", "gender": "male或female", "generation": 代数}
  ],
  "relationships": [
    {"person1": "姓名1", "person2": "姓名2", "relation": "father-son或mother-son或father-daughter或mother-daughter或husband-wife"}
  ]
}

如果文本中没有人名或家族关系，返回空的members和relationships数组。`;
  }

  buildPrompt(content) {
    const truncatedContent = content.length > 3000
      ? content.substring(0, 3000) + '...(内容已截断)'
      : content;

    return `请分析以下文本，提取所有人物及其直系亲属关系。

文本内容：
${truncatedContent}

请严格按照JSON格式返回结果。`;
  }

  parseAIResponse(responseText) {
    try {
      let jsonStr = responseText.trim();

      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1];
      }

      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('响应中未找到有效的JSON');
      }

      jsonStr = jsonMatch[0];

      const data = JSON.parse(jsonStr);

      if (!data.members || !Array.isArray(data.members)) {
        data.members = [];
      }
      if (!data.relationships || !Array.isArray(data.relationships)) {
        data.relationships = [];
      }

      const VALID_GENDERS = new Set(['male', 'female']);
      const VALID_RELATIONS = new Set([
        'father-son', 'mother-son', 'father-daughter', 'mother-daughter', 'husband-wife'
      ]);
      // 关系的"父/母"端必须对应男性/女性
      const PARENT_GENDER = {
        'father-son': 'male', 'father-daughter': 'male',
        'mother-son': 'female', 'mother-daughter': 'female'
      };
      const CHILD_GENDER = {
        'father-son': 'male', 'mother-son': 'male',
        'father-daughter': 'female', 'mother-daughter': 'female'
      };

      // 1. 规范化成员，丢弃性别/姓名缺失的记录
      const memberByName = new Map();
      const members = data.members
        .map((m, index) => {
          const name = (m.name || '').trim();
          const gender = VALID_GENDERS.has(m.gender) ? m.gender : 'unknown';
          const generation = Number.isInteger(m.generation) && m.generation >= 1
            ? m.generation
            : 1;
          if (!name) return null;
          const member = {
            id: `member_${index}`,
            name,
            gender,
            generation
          };
          memberByName.set(name, member);
          return member;
        })
        .filter(Boolean);

      // 2. 规范化关系，过滤非法或引用不存在成员的边
      const seenPairs = new Set();
      const relationships = data.relationships
        .map((rel) => {
          const p1 = (rel.person1 || '').trim();
          const p2 = (rel.person2 || '').trim();
          const relation = rel.relation;
          if (!p1 || !p2 || !VALID_RELATIONS.has(relation)) return null;
          if (!memberByName.has(p1) || !memberByName.has(p2)) return null;
          if (p1 === p2) return null;
          const m1 = memberByName.get(p1);
          const m2 = memberByName.get(p2);

          // 夫妻边：去掉重复并校验
          if (relation === 'husband-wife') {
            const dedupKey = `spouse:${[p1, p2].sort().join('|')}`;
            if (seenPairs.has(dedupKey)) return null;
            seenPairs.add(dedupKey);
            return { person1: p1, person2: p2, relation };
          }

          // 父子/母子边：校验性别匹配，禁止跨代（仅允许相邻 1 代）
          const parentName = p1;
          const childName = p2;
          const parent = m1;
          const child = m2;
          if (parent.gender !== PARENT_GENDER[relation]) return null;
          if (child.gender !== CHILD_GENDER[relation]) return null;
          if (parent.generation - child.generation !== -1) {
            // 仅允许父辈代际 = 子辈代际 - 1，禁止跨代直接连接
            return null;
          }
          const dedupKey = `pc:${parentName}->${childName}:${relation}`;
          if (seenPairs.has(dedupKey)) return null;
          seenPairs.add(dedupKey);
          return { person1: parentName, person2: childName, relation };
        })
        .filter(Boolean);

      return { members, relationships };

    } catch (error) {
      console.error('JSON解析失败:', error);
      console.error('原始响应:', responseText);
      return {
        members: [],
        relationships: [],
        error: '无法解析AI响应'
      };
    }
  }
}

module.exports = new AIService();
