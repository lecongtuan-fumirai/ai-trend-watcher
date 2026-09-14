import Parser from 'rss-parser';
import { BaseCollector } from './baseCollector.js';
import { createFeedItem } from '../pipeline/normalizer.js';

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Google News Feed Reader'
  }
});

export class NewsCollector extends BaseCollector {
  constructor(config = {}) {
    super('Google News');
    this.rssUrl = config.rss || 'https://news.google.com/rss/search?q=%22Artificial+Intelligence%22+OR+%22Large+Language+Model%22+OR+%22AI+Agent%22+when:24h&hl=en-US&gl=US&ceid=US:en';
  }

  async collect() {
    const items = [];
    console.log(`[News Collector] Đang quét tin tức AI nóng hổi từ Google News...`);

    try {
      const feed = await parser.parseURL(this.rssUrl);
      const entries = (feed.items || []).slice(0, 15);

      for (const entry of entries) {
        const fullTitle = entry.title || 'Untitled News';
        // Tách publisher khỏi tiêu đề (Google News thường có format: "Title - Publisher")
        const parts = fullTitle.split(' - ');
        const publisher = parts.length > 1 ? parts.pop() : 'Google News';
        const cleanTitle = parts.join(' - ');

        items.push(createFeedItem({
          source: 'google_news',
          title: `[News] ${cleanTitle} (${publisher})`,
          url: entry.link,
          author: publisher,
          content: entry.contentSnippet || entry.content || cleanTitle,
          publishedAt: entry.pubDate || entry.isoDate,
          score: 40, // Base score cho tin tức tổng hợp
          metadata: { publisher }
        }));
      }
      console.log(`[News Collector] Thu thập thành công ${items.length} tin tức từ Google News.`);
    } catch (err) {
      console.warn(`[News Collector] Lỗi khi nạp Google News RSS:`, err.message);
    }

    return items;
  }
}
