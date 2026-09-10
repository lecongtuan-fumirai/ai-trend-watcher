import Parser from 'rss-parser';
import { YoutubeTranscript } from 'youtube-transcript';
import { BaseCollector } from './baseCollector.js';
import { createFeedItem } from '../pipeline/normalizer.js';

const parser = new Parser({
  customFields: {
    item: [
      ['media:group', 'mediaGroup'],
      ['yt:videoId', 'videoId']
    ]
  }
});

export class YouTubeCollector extends BaseCollector {
  constructor(config = {}) {
    super('YouTube Podcasts');
    this.feedUrl = config.feed_url || 'https://raw.githubusercontent.com/zarazhangrui/follow-builders/main/feed-podcasts.json';
    this.channels = config.channels || [];
  }

  async collect() {
    const items = [];
    console.log(`[YouTube Collector] Đang quét các video & podcast AI mới nhất...`);

    // Cách 1: Quét trực tiếp các kênh YouTube podcast qua RSS chính thức
    for (const channel of this.channels) {
      if (!channel.rss) continue;
      try {
        const feed = await parser.parseURL(channel.rss);
        // Lấy tối đa 2 video mới nhất từ mỗi kênh để tiết kiệm tài nguyên
        const recentEntries = (feed.items || []).slice(0, 2);

        for (const entry of recentEntries) {
          const videoId = entry.videoId || entry.id?.split(':').pop();
          const videoUrl = entry.link || `https://www.youtube.com/watch?v=${videoId}`;
          let transcriptText = '';

          // Cố gắng bóc tách transcript nếu có
          if (videoId) {
            try {
              const transcript = await YoutubeTranscript.fetchTranscript(videoId);
              if (transcript && transcript.length > 0) {
                transcriptText = transcript.map(t => t.text).join(' ').slice(0, 3000);
              }
            } catch (tErr) {
              // Bỏ qua nếu video không bật caption
            }
          }

          const description = entry.mediaGroup?.['media:description']?.[0] || entry.contentSnippet || '';
          const fullContent = transcriptText ? `[TRANSCRIPT TRÍCH ĐOẠN]: ${transcriptText}` : description;

          items.push(createFeedItem({
            id: `yt_${videoId}`,
            source: 'youtube',
            title: `[Podcast] ${channel.name}: ${entry.title}`,
            url: videoUrl,
            author: channel.name,
            content: fullContent,
            publishedAt: entry.pubDate || entry.isoDate,
            score: 50, // Ưu tiên podcast kỹ thuật
            metadata: { channel: channel.name, hasTranscript: !!transcriptText }
          }));
        }
      } catch (err) {
        console.warn(`[YouTube Collector] Lỗi khi nạp RSS từ kênh ${channel.name}:`, err.message);
      }
    }

    // Cách 2: Tận dụng thêm curated feed từ follow-builders làm nguồn phụ
    try {
      const res = await this.safeFetch(this.feedUrl);
      const data = await res.json();
      const rawEpisodes = Array.isArray(data) ? data : (data.episodes || data.podcasts || []);

      for (const ep of rawEpisodes.slice(0, 10)) {
        if (!ep.url) continue;
        items.push(createFeedItem({
          id: ep.id ? `yt_feed_${ep.id}` : undefined,
          source: 'youtube',
          title: `[Podcast] ${ep.podcastName || ep.author || 'AI Podcast'}: ${ep.title}`,
          url: ep.url,
          author: ep.podcastName || ep.author,
          content: ep.summary || ep.description || ep.content || '',
          publishedAt: ep.publishedAt || ep.date,
          score: 60,
          metadata: { isCurated: true }
        }));
      }
    } catch (err) {
      // Feed phụ không bắt buộc
    }

    console.log(`[YouTube Collector] Thu thập thành công ${items.length} tập podcast/video.`);
    return items;
  }
}
