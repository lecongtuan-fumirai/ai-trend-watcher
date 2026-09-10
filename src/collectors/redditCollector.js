import Parser from 'rss-parser';
import { BaseCollector } from './baseCollector.js';
import { createFeedItem } from '../pipeline/normalizer.js';

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  }
});

export class RedditCollector extends BaseCollector {
  constructor(config = []) {
    super('Reddit AI');
    this.subreddits = config.length > 0 ? config : [
      { name: 'r/LocalLLaMA', rss: 'https://www.reddit.com/r/LocalLLaMA/top/.rss?t=day' },
      { name: 'r/MachineLearning', rss: 'https://www.reddit.com/r/MachineLearning/top/.rss?t=day' },
      { name: 'r/OpenAI', rss: 'https://www.reddit.com/r/OpenAI/top/.rss?t=day' }
    ];
  }

  async collect() {
    const items = [];
    console.log(`[Reddit Collector] Đang quét các thảo luận hàng đầu từ Reddit (RSS)...`);

    for (const sub of this.subreddits) {
      // Đảm bảo dùng endpoint .rss thay vì .json để không bị 403 Forbidden
      const rssUrl = sub.rss || sub.url?.replace('.json', '/.rss') || `https://www.reddit.com/${sub.name}/top/.rss?t=day`;

      try {
        const feed = await parser.parseURL(rssUrl);
        const entries = (feed.items || []).slice(0, 10);

        for (const entry of entries) {
          const title = entry.title || 'Untitled Reddit Post';
          const link = entry.link;
          if (!link) continue;

          // Nội dung HTML từ Reddit RSS được làm sạch
          const cleanSnippet = (entry.contentSnippet || entry.content || '')
            .replace(/submitted by\s+.*?\[link\]\s+\[comments\]/gi, '')
            .trim();

          items.push(createFeedItem({
            id: `reddit_${entry.id || link}`,
            source: 'reddit',
            title: `[${sub.name}] ${title}`,
            url: link,
            author: entry.author || sub.name,
            content: `[Cộng đồng ${sub.name}]\nTiêu đề: ${title}\nTrích đoạn: ${cleanSnippet.slice(0, 1000)}`,
            publishedAt: entry.pubDate || entry.isoDate,
            score: 55, // Base score cho thảo luận cộng đồng
            metadata: { subreddit: sub.name }
          }));
        }
      } catch (err) {
        console.warn(`[Reddit Collector] Lỗi khi lấy tin từ ${sub.name}:`, err.message);
      }

      // Giãn cách 1.5s giữa các subreddit để tránh bị Reddit giới hạn tốc độ (429)
      await new Promise(r => setTimeout(r, 1500));
    }

    console.log(`[Reddit Collector] Thu thập thành công ${items.length} bài thảo luận từ Reddit.`);
    return items;
  }
}
