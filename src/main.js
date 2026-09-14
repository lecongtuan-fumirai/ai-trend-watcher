import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

import { XCollector } from './collectors/xCollector.js';
import { YouTubeCollector } from './collectors/youtubeCollector.js';
import { RedditCollector } from './collectors/redditCollector.js';
import { BlogCollector } from './collectors/blogCollector.js';
import { GitHubCollector } from './collectors/githubCollector.js';
import { NewsCollector } from './collectors/newsCollector.js';

import { filterByTimeWindow } from './pipeline/timeFilter.js';
import { rankAndFilterTopK } from './pipeline/ranker.js';
import { Deduplicator } from './pipeline/deduplicator.js';
import { AIResearcher } from './agent/researcher.js';
import { GoogleChatNotifier } from './notifiers/googleChat.js';

// Đọc cấu hình các nguồn theo dõi
function loadSourcesConfig() {
  const configPath = path.resolve('config/sources.yaml');
  if (!fs.existsSync(configPath)) {
    throw new Error(`Không tìm thấy file cấu hình tại: ${configPath}`);
  }
  const fileContent = fs.readFileSync(configPath, 'utf-8');
  return yaml.load(fileContent);
}

async function main() {
  // Watchdog an toàn: Tự động ngắt tiến trình nếu vượt quá 6 phút để chống treo container
  const WATCHDOG_TIMEOUT_MS = 6 * 60 * 1000;
  const watchdog = setTimeout(() => {
    console.error(`\n[FATAL TIMEOUT] Toàn bộ pipeline vượt quá ${WATCHDOG_TIMEOUT_MS / 1000}s. Cưỡng chế thoát.`);
    process.exit(1);
  }, WATCHDOG_TIMEOUT_MS);
  watchdog.unref();

  const args = process.argv.slice(2);
  const isTestNotify = args.includes('--test-notify');
  const isTestCollect = args.includes('--test-collect');
  const isTestPipeline = args.includes('--test-pipeline');
  const isDryRun = args.includes('--dry-run');
  const isForceProd = args.includes('--force-prod');

  console.log('====================================================');
  console.log('  AI TREND WATCHER & BUILDER DIGEST PIPELINE');
  if (isTestPipeline) console.log('  [CHẾ ĐỘ KIỂM THỬ]: TEST PIPELINE (Không lưu cache, ưu tiên Test Space)');
  if (isDryRun)       console.log('  [CHẾ ĐỘ KIỂM THỬ]: DRY-RUN (Chỉ in ra màn hình, không gửi tin)');
  console.log('====================================================');

  // 1. Chế độ kiểm tra kết nối Google Chat Webhook
  if (isTestNotify) {
    console.log('[Mode] Kiểm tra kết nối Google Chat Webhook...');
    const notifier = new GoogleChatNotifier({ isTest: true, forceProd: isForceProd });
    try {
      await notifier.sendTestMessage();
      console.log('>> [HOÀN TẤT] Tiến trình kiểm tra Webhook kết thúc.');
    } catch (err) {
      console.error('>> [FAILED] Lỗi khi gửi webhook:', err.message);
    }
    return;
  }

  // 2. Tải cấu hình và khởi tạo các Collectors
  const sourcesConfig = loadSourcesConfig();
  const topK = parseInt(process.env.TOP_K_PER_SOURCE || '10', 10);

  const collectors = [
    new XCollector(sourcesConfig.x_builders),
    new YouTubeCollector(sourcesConfig.youtube_podcasts),
    new RedditCollector(sourcesConfig.reddit_subreddits),
    new BlogCollector(sourcesConfig.tech_blogs),
    new GitHubCollector(sourcesConfig.github_trending),
    new NewsCollector(sourcesConfig.google_news)
  ];

  console.log(`\n[1/4] Bắt đầu thu thập dữ liệu từ ${collectors.length} nguồn...`);
  const allItems = [];

  // Thu thập song song từ tất cả các nguồn với cơ chế chịu lỗi (Fault-tolerant)
  const results = await Promise.allSettled(collectors.map(c => c.collect()));
  for (let i = 0; i < results.length; i++) {
    const res = results[i];
    const collectorName = collectors[i].name;
    if (res.status === 'fulfilled') {
      allItems.push(...res.value);
    } else {
      console.error(`[Collector Error] Nguồn [${collectorName}] thất bại:`, res.reason?.message || res.reason);
    }
  }

  console.log(`>> Tổng số bài thu thập được: ${allItems.length}`);

  // 2. Lọc chính xác theo cửa sổ thời gian 24h (mặc định: từ 25h trước đến 1h trước thời điểm chạy)
  console.log(`\n[2/5] Lọc bài viết theo cửa sổ thời gian chính xác 24h...`);
  const lookbackHours = parseInt(process.env.LOOKBACK_HOURS || '24', 10);
  const bufferHours = parseInt(process.env.BUFFER_HOURS || '1', 10);
  const timeFilteredItems = filterByTimeWindow(allItems, lookbackHours, bufferHours);

  // 3. Lọc và xếp hạng chỉ lấy Top K bài tốt nhất mỗi nguồn
  console.log(`\n[3/5] Xếp hạng và chọn lọc Top ${topK} bài tốt nhất mỗi nguồn...`);
  const topItems = rankAndFilterTopK(timeFilteredItems, topK);

  // Nếu chỉ chạy test thu thập dữ liệu
  if (isTestCollect) {
    console.log(`\n>> [Mode: Test Collect] Kết quả Top ${topItems.length} bài được chọn:`);
    topItems.forEach((item, idx) => {
      console.log(`${idx + 1}. [${item.source.toUpperCase()}] ${item.title}`);
      console.log(`   Link: ${item.url} (Score: ${item.score})`);
    });
    return;
  }

  // 4. Lọc trùng lặp (Deduplication)
  console.log(`\n[4/5] Kiểm tra trùng lặp với lịch sử đã gửi...`);
  const deduplicator = new Deduplicator();
  const isTestMode = isDryRun || isTestPipeline;
  const freshItems = isTestMode ? topItems : deduplicator.filterUnseen(topItems);

  if (freshItems.length === 0) {
    console.log('>> Không có bài viết mới nào cần tổng hợp hôm nay. Kết thúc pipeline.');
    return;
  }

  // 5. AI Research Agent tổng hợp theo 3 trụ cột (Summary, Insights, Trends)
  console.log(`\n[5/5] Khởi động AI Research Agent chắt lọc tri thức...`);
  const researcher = new AIResearcher();
  let digestContent = '';

  try {
    digestContent = await researcher.generateDigest(freshItems);
  } catch (err) {
    console.error('>> [AI Error] Không thể tổng hợp bản tin:', err.message);
    return;
  }

  // 6. Gửi kết quả hoặc in ra terminal
  if (isDryRun) {
    console.log('\n================ BẢN TIN XUẤT RA (DRY-RUN) ================');
    console.log(digestContent);
    console.log('==========================================================');
    console.log('>> [DRY-RUN] Hoàn tất, không gửi webhook và không lưu cache.');
    return;
  }

  // Gửi tới Google Chat Webhook
  try {
    const notifier = new GoogleChatNotifier({
      isTest: isTestPipeline,
      forceProd: isForceProd
    });
    await notifier.sendDigest(digestContent);

    if (!isTestMode) {
      // Chỉ đánh dấu bài đã gửi vào cache khi chạy Production chính thức
      deduplicator.markAsSent(freshItems);
      console.log('>> [PIPELINE HOÀN TẤT] Bản tin đã được bắn thành công về Google Chat Space!');
    } else {
      console.log('>> [TEST MODE HOÀN TẤT] Đã bảo toàn cache sent_items.json cho lịch chạy chính thức.');
    }
  } catch (err) {
    console.error('>> [Dispatch Error] Lỗi khi gửi bản tin tới Google Chat:', err.message);
  }
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch(err => {
    console.error('[Fatal Error]:', err);
    process.exit(1);
  });
