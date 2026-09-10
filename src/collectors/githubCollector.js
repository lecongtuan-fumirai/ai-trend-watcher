import { BaseCollector } from './baseCollector.js';
import { createFeedItem } from '../pipeline/normalizer.js';

export class GitHubCollector extends BaseCollector {
  constructor(config = {}) {
    super('GitHub Trending');
  }

  async collect() {
    const items = [];
    console.log(`[GitHub Collector] Đang tìm kiếm các repository AI nổi bật nhất...`);

    // Tạo query tìm các repo AI/LLM được cập nhật gần đây với nhiều sao
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const queries = [
      `topic:ai-agent+pushed:>${oneWeekAgo}&sort=stars&order=desc`,
      `topic:llm+pushed:>${oneWeekAgo}&sort=stars&order=desc`
    ];

    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'AiTrendDigestBot/1.0'
    };

    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }

    const seenUrls = new Set();

    for (const query of queries) {
      try {
        const url = `https://api.github.com/search/repositories?q=${query}&per_page=10`;
        const res = await this.safeFetch(url, { headers });
        const data = await res.json();
        const repos = data?.items || [];

        for (const repo of repos) {
          if (seenUrls.has(repo.html_url)) continue;
          seenUrls.add(repo.html_url);

          const stars = repo.stargazers_count || 0;
          const forks = repo.forks_count || 0;
          const desc = repo.description || 'Không có mô tả';
          const topics = (repo.topics || []).join(', ');

          const content = `[Repository: ${repo.full_name}]\n⭐ Stars: ${stars} | 🍴 Forks: ${forks} | Ngôn ngữ: ${repo.language || 'N/A'}\nTopics: ${topics}\nMô tả: ${desc}`;

          items.push(createFeedItem({
            id: `gh_${repo.id}`,
            source: 'github',
            title: `[GitHub] ${repo.full_name}: ⭐ ${stars} stars — ${desc.slice(0, 80)}`,
            url: repo.html_url,
            author: repo.owner?.login || 'Open Source',
            content,
            publishedAt: repo.pushed_at || repo.updated_at,
            score: stars,
            metadata: { stars, forks, language: repo.language }
          }));
        }
      } catch (err) {
        console.warn(`[GitHub Collector] Lỗi khi tìm repo (${query}):`, err.message);
      }
    }

    console.log(`[GitHub Collector] Thu thập thành công ${items.length} repositories AI.`);
    return items;
  }
}
