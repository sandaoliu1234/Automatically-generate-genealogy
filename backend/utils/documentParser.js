const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

// PDF 解析硬性超时（毫秒），避免扫描件/损坏文件导致 worker 长时间卡住
const PDF_PARSE_TIMEOUT_MS = 30000;
// DOCX 解析硬性超时（毫秒）
const DOCX_PARSE_TIMEOUT_MS = 30000;

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
        // mammoth 仅支持 .docx；旧版二进制 .doc 必须另存为 .docx 后再上传
        throw new Error('不支持旧版 .doc 格式，请在 Word 中"另存为 .docx"后重新上传');
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
      const result = await withTimeout(
        mammoth.extractRawText({ buffer }),
        DOCX_PARSE_TIMEOUT_MS,
        'Word 解析'
      );
      return result.value;
    } catch (error) {
      throw new Error(`Word文档解析失败: ${error.message}`);
    }
  }
}

module.exports = new DocumentParser();
