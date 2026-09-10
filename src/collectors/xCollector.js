import fs from 'fs';
import path from 'path';
import { BaseCollector } from './baseCollector.js';
import { createFeedItem } from '../pipeline/normalizer.js';

export class XCollector extends BaseCollector {
  constructor(config = {}) {
    super('X (Twitter)');
    this.feedUrl = config.feed_url || 'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-x.json';
    this.localPath = path.resolve('data/feed-x.json');
    this.builders = config.builders || [];
  }

  async collect() {
    const items = [];
    console.log(`[X Collector] Đang nạp danh sách bài đăng từ các AI Builders...`);

    let data = null;

    // 1. Thử fetch từ GitHub central feed
    try {
      const res = await this.safeFetch(this.feedUrl, {}, 10000);
      data = await res.json();
    } catch (err) {
      console.warn(`[X Collector] Không thể tải feed X từ remote (${err.message}). Dùng cache cục bộ.`);
    }

    // 2. Fallback sang file data/feed-x.json nếu remote lỗi
    if (!data && fs.existsSync(this.localPath)) {
      try {
        const raw = fs.readFileSync(this.localPath, 'utf-8');
        data = JSON.parse(raw);
      } catch (err) {
        console.warn(`[X Collector] Không thể đọc file cache cục bộ: ${err.message}`);
      }
    }

    if (!data) {
      console.warn(`[X Collector] Không tìm thấy dữ liệu feed-x nào.`);
      return items;
    }

    // 3. Chuẩn hóa dữ liệu theo cấu trúc follow-builders (data.x là danh sách builders)
    const buildersList = data.x || [];

    for (const builder of buildersList) {
      const authorName = builder.name || builder.handle || 'AI Builder';
      const role = builder.bio ? ` (${builder.bio})` : '';
      const tweets = builder.tweets || [];

      for (const tweet of tweets) {
        const text = tweet.text || '';
        if (!text || text.length < 15) continue;

        const url = tweet.url || `https://x.com/${builder.handle}/status/${tweet.id}`;
        const likes = Number(tweet.likes || 0);
        const retweets = Number(tweet.retweets || 0);
        const score = likes + retweets * 2;

        const firstLine = text.split('\n')[0].replace(/[#@]/g, '').trim();
        const shortTitle = firstLine.length > 80 ? firstLine.slice(0, 80) + '...' : firstLine;

        items.push(createFeedItem({
          id: tweet.id ? `x_${tweet.id}` : undefined,
          source: 'x',
          title: `[X] ${authorName}${role}: ${shortTitle}`,
          url,
          author: `${authorName} (@${builder.handle})`,
          content: `${authorName}${role}:\n"${text}"`,
          publishedAt: tweet.createdAt,
          score,
          metadata: { likes, retweets, handle: builder.handle }
        }));
      }
    }

    console.log(`[X Collector] Thu thập thành công ${items.length} bài đăng từ X builders.`);
    return items;
  }
}
