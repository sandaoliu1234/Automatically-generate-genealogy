const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const WordExtractor = require('word-extractor');

const wordExtractor = new WordExtractor();

// PDF 解析硬性超时（毫秒），避免扫描件/损坏文件导致 worker 长时间卡住
const PDF_PARSE_TIMEOUT_MS = 30000;
// DOCX 解析硬性超时（毫秒）
const DOCX_PARSE_TIMEOUT_MS = 30000;
// DOC 解析硬性超时（毫秒）
const DOC_PARSE_TIMEOUT_MS = 30000;

const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label}超时（>${ms / 1000}s），文件可能损坏或过大`)), ms)
    )
  ]);

class DocumentParser {
  async parseDocument(file) {
    const ext = file.originalname.split('.').pop().toLowerCase();

    switch (ext) {
      case 'txt':
        return this.parseTxt(file.buffer);
      case 'pdf':
        return this.parsePdf(file.buffer);
      case 'docx':
        return this.parseDocx(file.buffer);
      case 'doc':
        return this.parseDoc(file.buffer);
      default:
        throw new Error(`不支持的文件格式: .${ext}`);
    }
  }

  parseTxt(buffer) {
    return buffer.toString('utf-8');
  }

  async parsePdf(buffer) {
    try {
      const data = await withTimeout(pdfParse(buffer), PDF_PARSE_TIMEOUT_MS, 'PDF 解析');
      return data.text;
    } catch (error) {
      throw new Error(`PDF解析失败: ${error.message}`);
    }
  }

  async parseDocx(buffer) {
    try {
      // mammoth 在处理损坏 .docx 时会从 JSZip 内部抛 "Cannot read properties of undefined (reading 'parseDocx')"
      // 这种错误有时是同步抛出的（不在 await 中），需要 setImmediate 包一层确保走异步路径
      const task = new Promise((resolve, reject) => {
        setImmediate(() => {
          try {
            mammoth.extractRawText({ buffer }).then(resolve, reject)
          } catch (syncErr) {
            reject(syncErr)
          }
        })
      })
      const result = await withTimeout(task, DOCX_PARSE_TIMEOUT_MS, 'Word 解析')
      return result.value
    } catch (error) {
      throw new Error(`Word文档解析失败: ${error.message}`)
    }
  }
  async parseDoc(buffer) {
    try {
      const task = wordExtractor.extract(buffer).then(doc => doc.getBody());
      const text = await withTimeout(task, DOC_PARSE_TIMEOUT_MS, 'Word(.doc) 解析');
      if (!text || !text.trim()) {
        throw new Error('文档内容为空，请确认 .doc 文件中包含文字信息');
      }
      return text;
    } catch (error) {
      throw new Error(`Word(.doc)文档解析失败: ${error.message}`);
    }
  }
}

module.exports = new DocumentParser();
