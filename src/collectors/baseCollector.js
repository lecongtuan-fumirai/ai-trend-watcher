/**
 * Lớp cơ sở trừu tượng cho tất cả các Collectors
 */
export class BaseCollector {
  constructor(name) {
    this.name = name;
  }

  /**
   * Phương thức thu thập dữ liệu - các lớp con bắt buộc phải override
   * @returns {Promise<Array>} Danh sách FeedItem
   */
  async collect() {
    throw new Error(`Method collect() must be implemented in ${this.name}`);
  }

  /**
   * Helper fetch an toàn kèm timeout
   */
  async safeFetch(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          ...(options.headers || {})
        }
      });
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      throw err;
    }
  }
}
