import fs from 'fs';
import path from 'path';

const CACHE_FILE = path.resolve('cache/sent_items.json');
const MAX_CACHE_AGE_DAYS = 7;

/**
 * Quản lý deduplication bằng file JSON cục bộ
 */
export class Deduplicator {
  constructor() {
    this.cache = this.loadCache();
  }

  loadCache() {
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
        const data = JSON.parse(raw);
        // Dọn dẹp các cache quá hạn (hơn 7 ngày)
        const now = Date.now();
        const cleaned = {};
        for (const [key, timestamp] of Object.entries(data)) {
          if (now - timestamp < MAX_CACHE_AGE_DAYS * 24 * 60 * 60 * 1000) {
            cleaned[key] = timestamp;
          }
        }
        return cleaned;
      }
    } catch (err) {
      console.warn('[Deduplicator] Không thể đọc cache, khởi tạo mới:', err.message);
    }
    return {};
  }

  saveCache() {
    try {
      const dir = path.dirname(CACHE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(CACHE_FILE, JSON.stringify(this.cache, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Deduplicator] Lỗi khi lưu cache:', err.message);
    }
  }

  /**
   * Lọc bỏ những bài đã từng xuất hiện trong cache
   */
  filterUnseen(items) {
    const unseen = items.filter(item => {
      const key = item.id || item.url;
      return !this.cache[key];
    });
    console.log(`[Deduplicator] Tổng ${items.length} bài -> Còn lại ${unseen.length} bài mới chưa từng xử lý.`);
    return unseen;
  }

  /**
   * Đánh dấu danh sách các bài đã được xử lý thành công
   */
  markAsSent(items) {
    const now = Date.now();
    for (const item of items) {
      const key = item.id || item.url;
      this.cache[key] = now;
    }
    this.saveCache();
  }
}
