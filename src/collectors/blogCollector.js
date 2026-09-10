import Parser from 'rss-parser';
import { BaseCollector } from './baseCollector.js';
import { createFeedItem } from '../pipeline/normalizer.js';

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AI Trend Watcher / RSS Parser'
  }
});

export class BlogCollector extends BaseCollector {
  constructor(config = []) {
    super('Tech Blogs');
    this.blogs = config.length > 0 ? config : [
      { name: 'Anthropic Research', rss: 'https://www.anthropic.com/feed.xml' },
      { name: 'OpenAI News', rss: 'https://openai.com/news/rss.xml' },
      { name: 'Google DeepMind', rss: 'https://deepmind.google/blog/rss.xml' },
      { name: 'Hugging Face Blog', rss: 'https://huggingface.co/blog/feed.xml' },
      { name: 'Simon Willison', rss: 'https://simonwillison.net/atom/everything/' }
    ];
  }

  async collect() {
    const items = [];
    console.log(`[Blog Collector] Đang duyệt các blog kỹ thuật từ các AI Labs & Engineers...`);

    for (const blog of this.blogs) {
      if (!blog.rss) continue;
      try {
        const feed = await parser.parseURL(blog.rss);
        // Lấy tối đa 2 bài mới nhất từ mỗi blog
        const entries = (feed.items || []).slice(0, 2);

        for (const entry of entries) {
          const title = entry.title || 'Untitled Blog Post';
          const url = entry.link || entry.guid;
          if (!url) continue;

          const content = entry['content:encoded'] || entry.content || entry.contentSnippet || entry.summary || '';

          items.push(createFeedItem({
            source: 'blogs',
            title: `[Blog] ${blog.name}: ${title}`,
            url,
            author: entry.creator || entry.author || blog.name,
            content,
            publishedAt: entry.pubDate || entry.isoDate,
            score: 70, // Ưu tiên cao cho bài viết kỹ thuật chuyên sâu từ Lab
            metadata: { blogName: blog.name }
          }));
        }
      } catch (err) {
        console.warn(`[Blog Collector] Không thể lấy RSS từ ${blog.name}:`, err.message);
      }
    }

    console.log(`[Blog Collector] Thu thập thành công ${items.length} bài viết blog kỹ thuật.`);
    return items;
  }
}
