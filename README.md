# 🚀 AI Trend Watcher & Builder Digest

> **"Follow Builders, Not Influencers."**  
> Hệ thống tự động nghiên cứu, chắt lọc xu hướng AI từ các kỹ sư & founder đầu ngành và gửi bản tin tổng hợp hàng ngày về Google Chat qua Webhook.

---

## 🎯 Mục Tiêu & Triết Lý Hệ Thống

95% thông tin AI trên mạng xã hội hiện nay là tin giật gân, quảng cáo công cụ và bài viết bề nổi. Dự án này được thiết kế theo triết lý của repo [zarazhangrui/follow-builders](https://github.com/zarazhangrui/follow-builders) nhằm:
- Theo dõi trực tiếp những người **đang thực sự xây dựng sản phẩm AI** (Andrej Karpathy, Sam Altman, Simon Willison, Swyx, Harrison Chase...).
- Lọc lấy **Top 10 nội dung chất lượng nhất mỗi nguồn** trong 24h.
- AI Research Agent (dùng **1 API Key**) tự động bóc tách thành 3 trụ cột:
  1. 📌 **Summary:** Điểm tin bứt phá, bản phát hành mới kèm link gốc.
  2. 💡 **Builder Insights:** Bài học kiến trúc, kinh nghiệm tối ưu hóa thực chiến (context window, latency, agent loop, quant).
  3. 📈 **Trends & Repos:** Xu hướng công nghệ đang hình thành & Top GitHub Repos đáng chú ý.
- Bắn thông báo trực tiếp về **Google Chat Space** qua Incoming Webhook.

---

## 📐 Kiến Trúc Luồng Dữ Liệu

```
                ┌── X (26 Curated Builders)
                ├── YouTube (AI Podcasts & Transcripts)
                ├── Reddit (r/LocalLLaMA, r/MachineLearning)
Sources ────────┼── Tech Blogs (Anthropic, OpenAI, DeepMind, v.v.)
                ├── GitHub Trending (Topic: LLM, AI Agent)
                └── Google News (Breaking AI)
                     ↓
        Top 10 Slicer & Central Feed (Tối đa 60 bài tinh hoa)
                     ↓
             Deduplication Filter (Loại bỏ bài đã gửi trong 7 ngày)
                     ↓
             AI Research Agent (Gemini 2.5 Flash / OpenAI)
                     ↓
     Format: <URL|Tiêu đề bài viết> + Summary + Insights + Trends
                     ↓
          Google Chat Incoming Webhook
```

---

## 🛠️ Cài Đặt & Khởi Tạo

### 1. Cài đặt thư viện:
Yêu cầu **Node.js 18+** hoặc **20+**:

```bash
cd ai-trend-watcher
npm install
# hoặc nếu bạn dùng pnpm:
pnpm install
```

### 2. Cấu hình biến môi trường (`.env`):
Sao chép từ file mẫu:
```bash
cp .env.example .env
```

Mở file `.env` và điền:
```env
# 1. API Key duy nhất (Khuyên dùng Gemini vì miễn phí, siêu nhanh và context lớn)
AI_PROVIDER=gemini
AI_API_KEY=AIzaSy...your_gemini_api_key...
AI_MODEL=gemini-2.5-flash

# 2. Google Chat Webhook URL (Xem hướng dẫn lấy bên dưới)
GOOGLE_CHAT_WEBHOOK_URL=https://chat.googleapis.com/v1/spaces/AAAA.../messages?key=BBBB&token=CCCC

# 3. Số bài tối đa lấy mỗi nguồn (mặc định 10)
TOP_K_PER_SOURCE=10
```

> **Cách lấy Google Chat Webhook URL:**
> 1. Mở không gian (Space) trên Google Chat bạn muốn nhận tin.
> 2. Bấm vào tên Space ở trên cùng -> chọn **Ứng dụng và tiện ích tích hợp (Apps & Integrations)** -> **Webhooks**.
> 3. Chọn **Thêm webhook (Add Webhook)**, đặt tên là `AI Builder Digest`, bấm **Lưu**.
> 4. Sao chép URL webhook và dán vào `GOOGLE_CHAT_WEBHOOK_URL`.

---

## 🚀 Các Lệnh Sử Dụng

### 1. Kiểm tra kết nối Google Chat Webhook:
Bắn thử 1 tin nhắn test để xác nhận webhook hoạt động tốt:
```bash
npm run test-notify
```

### 2. Kiểm tra cào tin (Không tốn token AI):
Xem thử 6 nguồn cào được bao nhiêu bài và Top 10 bài được chọn lọc:
```bash
npm run test-collect
```

### 3. Chạy thử nghiệm AI (Dry-Run):
Cào tin, gọi AI tóm tắt và in toàn bộ bản tin ra Terminal (không gửi Google Chat, không lưu cache):
```bash
npm run dry-run
```

### 4. Chạy chính thức:
Cào tin, gọi AI, bắn bản tin về Google Chat và lưu cache chống trùng lặp:
```bash
npm run start
# hoặc: node src/main.js
```

---

## ⏰ Tự Động Hóa Chạy Hàng Ngày

### Cách 1: Chạy miễn phí 100% bằng GitHub Actions (Khuyên dùng)
Dự án đã có sẵn file `.github/workflows/daily_digest.yml`. Bạn chỉ cần:
1. Đẩy repo lên GitHub.
2. Vào **Settings** -> **Secrets and variables** -> **Actions** -> Thêm:
   - `AI_API_KEY`: API key của bạn.
   - `GOOGLE_CHAT_WEBHOOK_URL`: Webhook URL của Google Chat.
3. Hệ thống sẽ tự động chạy vào **07:00 sáng mỗi ngày (giờ Việt Nam)** và tự động commit cache chống trùng lặp.

### Cách 2: Chạy bằng Cron trên Linux/VPS hoặc Windows Task Scheduler
Thêm vào `crontab -e`:
```bash
0 7 * * * cd /path/to/ai-trend-watcher && /usr/bin/node src/main.js >> digest.log 2>&1
```

### Cách 3: Chạy bằng Docker & Docker Compose
**1. Khởi động hệ thống tự động chạy 07:00 sáng mỗi ngày:**
```bash
docker compose up -d
```
*(Cụm bao gồm `ai_trend_watcher` và scheduler `ofelia` siêu nhẹ tự động kích hoạt container mỗi ngày).*

**2. Chạy thử nghiệm ngay lập tức (Test / Dry-Run):**
```bash
# Chạy 1 lần thử nghiệm không gửi Google Chat:
docker compose exec watcher npm run dry-run

# Chạy chính thức ngay lập tức (khi container đang chạy):
docker compose exec watcher node src/main.js
```

---

## 📂 Cấu Trúc Mã Nguồn

- `config/sources.yaml`: Danh sách các builders, YouTube channels, subreddits, blogs theo dõi.
- `src/collectors/`: 6 bộ cào độc lập cho X, YouTube, Reddit, Blogs, GitHub, News.
- `src/pipeline/normalizer.js`: Chuẩn hóa dữ liệu về định dạng thống nhất.
- `src/pipeline/ranker.js`: Thuật toán chấm điểm và cắt Top 10 bài tốt nhất.
- `src/pipeline/deduplicator.js`: Bộ lọc chống gửi trùng lặp qua cache `cache/sent_items.json`.
- `src/agent/researcher.js`: AI Research Agent gọi Gemini / OpenAI API.
- `src/agent/prompts.js`: Định dạng prompt chuẩn Google Chat `<URL|Tiêu đề>`.
- `src/notifiers/googleChat.js`: Module bắn tin nhắn tới Google Chat (tự chia nhỏ tin nếu dài).
- `src/main.js`: Nhạc trưởng điều phối toàn bộ workflow.
