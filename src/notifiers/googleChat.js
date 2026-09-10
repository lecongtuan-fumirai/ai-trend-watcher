/**
 * Module gửi tin nhắn đến Google Chat Incoming Webhook
 */
export class GoogleChatNotifier {
  constructor(webhookUrl) {
    this.webhookUrl = webhookUrl || process.env.GOOGLE_CHAT_WEBHOOK_URL;
  }

  /**
   * Gửi bản tin hoàn chỉnh đến Google Chat
   * Tự động chia nhỏ tin nhắn nếu vượt quá giới hạn độ dài an toàn (~3800 ký tự)
   * @param {string} text - Nội dung bản tin đã định dạng
   */
  async sendDigest(text) {
    if (!this.webhookUrl) {
      throw new Error('Chưa cấu hình GOOGLE_CHAT_WEBHOOK_URL trong file .env');
    }

    console.log(`[Google Chat] Đang chuẩn bị gửi bản tin tới Google Chat Space...`);

    const chunks = this.splitMessage(text, 3800);
    console.log(`[Google Chat] Bản tin được chia làm ${chunks.length} phần để đảm bảo giới hạn ký tự.`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      await this.postToWebhook(chunk);
      // Giãn cách nhẹ 500ms giữa các tin nhắn để giữ đúng thứ tự hiển thị
      if (i < chunks.length - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    console.log(`[Google Chat] Gửi bản tin thành công!`);
  }

  /**
   * Gửi 1 tin nhắn đơn tới Webhook
   */
  async postToWebhook(messageText) {
    const payload = {
      text: messageText
    };

    const res = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8'
      },
      body: JSON.stringify(payload)
    });

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
• Thời gian kiểm tra: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
• Trạng thái: ✅ Sẵn sàng hoạt động
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();

    return await this.postToWebhook(testText);
  }

  /**
   * Chia nhỏ văn bản an toàn theo các đường kẻ phân cách hoặc dòng mới
   */
  splitMessage(text, maxLen = 3800) {
    if (text.length <= maxLen) {
      return [text];
    }

    const chunks = [];
    const lines = text.split('\n');
    let currentChunk = '';

    for (const line of lines) {
      if ((currentChunk + '\n' + line).length > maxLen) {
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = line;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}
