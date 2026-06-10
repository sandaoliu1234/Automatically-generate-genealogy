const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

class DocumentParser {
  async parseDocument(file) {
    const ext = file.originalname.split('.').pop().toLowerCase();

    switch (ext) {
      case 'txt':
        return this.parseTxt(file.buffer);
      case 'pdf':
        return this.parsePdf(file.buffer);
      case 'doc':
      case 'docx':
        return this.parseDocx(file.buffer);
      default:
        throw new Error(`不支持的文件格式: .${ext}`);
    }
  }

  parseTxt(buffer) {
    return buffer.toString('utf-8');
  }

  async parsePdf(buffer) {
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      throw new Error(`PDF解析失败: ${error.message}`);
    }
  }

  async parseDocx(buffer) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw new Error(`Word文档解析失败: ${error.message}`);
    }
  }
}

module.exports = new DocumentParser();
