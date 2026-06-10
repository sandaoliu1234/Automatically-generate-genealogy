const axios = require('axios');

class AIService {
  constructor() {
    this.defaultApiKey = process.env.API_KEY;
    this.endpoint = process.env.AI_ENDPOINT || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    this.model = process.env.AI_MODEL || 'qwen-plus';
  }

  async analyzeDocument(content, userApiKey = null) {
    const prompt = this.buildPrompt(content);
    const apiKey = userApiKey || this.defaultApiKey;

    if (!apiKey || apiKey.trim() === '') {
      throw new Error('未配置API Key，请点击右上角"设置"按钮输入您的阿里云百炼API Key');
    }

    try {
      const response = await axios.post(
        `${this.endpoint}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'system',
              content: `你是一个专业的族谱分析助手。你的任务是从文本中提取家族成员及其直系亲属关系。

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

如果文本中没有人名或家族关系，返回空的members和relationships数组。`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 2000
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      const aiContent = response.data.choices[0].message.content;
      console.log('AI原始响应:', aiContent);

      return this.parseAIResponse(aiContent);

    } catch (error) {
      console.error('AI API调用失败:', error.response?.data || error.message);
      if (error.response?.data?.error?.message) {
        throw new Error(`AI分析失败: ${error.response.data.error.message}`);
      }
      throw new Error(`AI分析失败: ${error.message}`);
    }
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

      data.members = data.members.map((member, index) => ({
        id: `member_${index}`,
        name: member.name || `未知成员${index + 1}`,
        gender: member.gender || 'unknown',
        generation: member.generation || 1
      }));

      return data;

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
