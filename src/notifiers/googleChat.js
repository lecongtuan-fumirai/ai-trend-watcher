/**
 * Module gửi tin nhắn đến Google Chat Incoming Webhook
 */
export class GoogleChatNotifier {
  constructor(webhookUrl) {
    this.webhookUrl = webhookUrl || process.env.GOOGLE_CHAT_WEBHOOK_URL;
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
    if (!this.webhookUrl) {
      throw new Error('Chưa cấu hình GOOGLE_CHAT_WEBHOOK_URL trong file .env');
    }

    const text = this.formatForGoogleChat(rawText);
    console.log(`[Google Chat] Đang chuẩn bị gửi bản tin tới Google Chat Space (${text.length} ký tự)...`);

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

    console.log(`[Google Chat] Hoàn tất gửi toàn bộ bản tin!`);
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
    const testText = `
🔔 *AI TREND WATCHER | WEBHOOK TEST*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Kết nối Google Chat Webhook thành công!
Hệ thống sẵn sàng nhận bản tin AI Builder Digest mỗi ngày.
• Thời gian: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
• Trạng thái: ✅ Hoạt động ổn định
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();

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
