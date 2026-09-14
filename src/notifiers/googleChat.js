import fs from 'fs';
import path from 'path';

/**
 * Module gửi tin nhắn đến Google Chat Incoming Webhook
 */
export class GoogleChatNotifier {
  constructor(options = {}) {
    // Cho phép truyền string URL (tương thích ngược) hoặc object options
    if (typeof options === 'string') {
      this.webhookUrl = options;
      this.isTest = false;
      this.forceProd = false;
      this.targetName = 'CUSTOM_URL';
    } else {
      this.isTest = !!options.isTest;
      this.forceProd = !!options.forceProd;
      this.testWebhookUrl = process.env.GOOGLE_CHAT_TEST_WEBHOOK_URL || '';
      this.prodWebhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL || '';

      if (this.isTest && !this.forceProd) {
        this.webhookUrl = this.testWebhookUrl;
        this.targetName = this.testWebhookUrl ? 'TEST SPACE (GOOGLE_CHAT_TEST_WEBHOOK_URL)' : 'NONE';
      } else {
        this.webhookUrl = this.prodWebhookUrl;
        this.targetName = 'PRODUCTION SPACE (GOOGLE_CHAT_WEBHOOK_URL)';
      }
    }
  }

  /**
   * Chuẩn hóa định dạng Markdown cho tương thích hoàn toàn với Google Chat:
   * - Google Chat chỉ hỗ trợ *bold* (1 dấu sao), không hỗ trợ **bold** (2 dấu sao)
   * - Tự động sửa lại nếu LLM vô tình sinh ra **
   */
  formatForGoogleChat(text) {
    if (!text) return '';
    return text
      .replace(/\*\*\*([^*]+)\*\*\*/g, '*_$1_*') // bold italic
      .replace(/\*\*([^*]+)\*\*/g, '*$1*')       // chuyển **text** thành *text*
      .replace(/__([^_]+)__/g, '_$1_');          // chuyển __text__ thành _text_
  }

  /**
   * Gửi bản tin hoàn chỉnh đến Google Chat
   * @param {string} rawText - Nội dung bản tin đã định dạng
   */
  async sendDigest(rawText) {
    // 1. Kiểm tra an toàn: Nếu đang test mà chưa cấu hình test webhook
    if (this.isTest && !this.webhookUrl) {
      console.warn('\n=============================================================');
      console.warn('⚠️  [CHẾ ĐỘ AN TOÀN]: Đang chạy ở chế độ TEST.');
      console.warn('   Không tìm thấy biến GOOGLE_CHAT_TEST_WEBHOOK_URL trong .env.');
      console.warn('   Hệ thống TỰ ĐỘNG CHẶN gửi vào Production để tránh spam kênh chính!');
      console.warn('   Nội dung bản tin đã được lưu tại: cache/digest_test_preview.md');
      console.warn('=============================================================\n');

      const previewPath = path.resolve('cache/digest_test_preview.md');
      fs.writeFileSync(previewPath, rawText, 'utf-8');
      return;
    }

    if (!this.webhookUrl) {
      throw new Error('Chưa cấu hình GOOGLE_CHAT_WEBHOOK_URL trong file .env');
    }

    let text = this.formatForGoogleChat(rawText);

    // Gắn tag rõ ràng nếu gửi vào Test Space
    if (this.isTest) {
      text = `🧪 *[BẢN TIN THỬ NGHIỆM / TEST PIPELINE]*\n_⚠️ Tin nhắn kiểm thử kỹ thuật, không phải bản tin chính thức._\n\n${text}`;
    }

    console.log(`[Google Chat] Đích gửi: [${this.targetName}]`);
    console.log(`[Google Chat] Đang chuẩn bị gửi bản tin tới Space (${text.length} ký tự)...`);

    // Phân đoạn an toàn theo Section (tối đa 3500 ký tự mỗi tin để Google Chat hiển thị trọn vẹn)
    const chunks = this.splitMessageBySection(text, 3600);
    console.log(`[Google Chat] Số tin nhắn cần gửi: ${chunks.length}`);

    for (let i = 0; i < chunks.length; i++) {
      let chunk = chunks[i];
      // Nếu có nhiều hơn 1 phần, gắn thêm nhãn [Phần i/N] để người đọc dễ theo dõi
      if (chunks.length > 1) {
        chunk = `📌 *[PHẦN ${i + 1}/${chunks.length}]*\n\n${chunk}`;
      }

      await this.postToWebhook(chunk);
      console.log(`[Google Chat] Đã gửi xong phần ${i + 1}/${chunks.length}.`);

      // Giãn cách 1.2s giữa các tin để đảm bảo đúng thứ tự trên Google Chat Space
      if (i < chunks.length - 1) {
        await new Promise(r => setTimeout(r, 1200));
      }
    }

    console.log(`[Google Chat] Hoàn tất gửi toàn bộ bản tin tới [${this.targetName}]!`);
  }

  /**
   * Gửi 1 tin nhắn đơn tới Webhook
   */
  async postToWebhook(messageText) {
    const payload = {
      text: messageText
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    let res;
    try {
      res = await fetch(this.webhookUrl, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json; charset=UTF-8'
        },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Google Chat Webhook request timed out sau 20s');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Google Chat Webhook failed (${res.status}): ${errBody}`);
    }

    return await res.json();
  }

  /**
   * Bắn tin nhắn thử nghiệm kiểm tra kết nối webhook
   */
  async sendTestMessage() {
    if (this.isTest && !this.webhookUrl) {
      console.warn('\n=============================================================');
      console.warn('⚠️  [CHẾ ĐỘ AN TOÀN]: Đang test kết nối Webhook.');
      console.warn('   Chưa cấu hình GOOGLE_CHAT_TEST_WEBHOOK_URL trong file .env.');
      console.warn('   Hệ thống TỰ ĐỘNG CHẶN gửi vào kênh chính để tránh spam!');
      console.warn('   👉 Để test kênh chính thức, hãy chạy:');
      console.warn('      npm run test-notify -- --force-prod');
      console.warn('   👉 Hoặc thêm GOOGLE_CHAT_TEST_WEBHOOK_URL vào .env để test riêng.');
      console.warn('=============================================================\n');
      return;
    }

    const channelType = this.forceProd ? '🔴 PRODUCTION CHANNEL' : '🧪 TEST CHANNEL';
    const testText = `
🔔 *AI TREND WATCHER | WEBHOOK TEST*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Kết nối Google Chat Webhook thành công!
• Đích nhận: *${channelType}*
• Thời gian: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
• Trạng thái: ✅ Hoạt động ổn định
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();

    console.log(`[Google Chat] Đang bắn tin nhắn test tới: [${this.targetName}]...`);
    return await this.postToWebhook(testText);
  }

  /**
   * Chia nhỏ văn bản thông minh theo từng Section (dấu phân cách ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━)
   * Không bao giờ cắt ngang giữa câu hay giữa chừng một dòng!
   */
  splitMessageBySection(text, maxLen = 3600) {
    if (text.length <= maxLen) {
      return [text];
    }

    // Tách theo đường phân cách section
    const sections = text.split(/(?=━━━━━━━━━━━━━━━━━━━━━━━━━━━━━)/g);
    const chunks = [];
    let currentChunk = '';

    for (const section of sections) {
      if ((currentChunk + section).length > maxLen) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = section;
      } else {
        currentChunk += section;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [text];
  }
}
