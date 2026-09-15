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

## 🚀 Bảng Tra Cứu Lệnh Sử Dụng (Commands Cheatsheet)

Dự án phân tách rạch ròi giữa **Lệnh Test an toàn (không spam kênh chính)** và **Lệnh chạy Production chính thức**:

| Lệnh (NPM) | Chạy trong Docker Container | Đích nhận | Ảnh hưởng kênh chính? | Mô tả chức năng |
| :--- | :--- | :--- | :---: | :--- |
| `npm run dry-run` | `docker exec ai_trend_watcher npm run dry-run` | **Terminal Only** | ❌ Không | Cào dữ liệu, AI tổng hợp bản tin và in ra màn hình. Không gọi Webhook, không lưu cache. |
| `npm run test:collect` | `docker exec ai_trend_watcher npm run test:collect` | **Terminal Only** | ❌ Không | Chỉ test cào tin từ 6 nguồn & chấm điểm Top 10. Không tốn token AI. |
| `npm run test:notify` | `docker exec ai_trend_watcher npm run test:notify` | **Test Space** (hoặc chặn) | ❌ Không | Bắn 1 tin test kết nối Webhook. **Tự động chặn** nếu chưa cấu hình `GOOGLE_CHAT_TEST_WEBHOOK_URL` để bảo vệ kênh chính. |
| `npm run test:pipeline` | `docker exec ai_trend_watcher npm run test:pipeline` | **Test Space** (hoặc file preview) | ❌ Không | Test trọn vẹn luồng cào tin + AI tổng hợp ➔ bắn vào kênh Test (kèm tag `🧪 [TEST]`). Không làm bẩn cache `sent_items.json`. |
| `npm run test:notify:prod` | `docker exec ai_trend_watcher npm run test:notify:prod` | **Production Space** | ⚠️ Có | **Cố tình test gửi vào kênh chính**: Phải thêm cờ `--force-prod` tường minh mới gửi được. |
| **`npm start`** *(hoặc `node src/main.js`)* | **`docker exec ai_trend_watcher node src/main.js`** | **Production Space** | ✅ **Kênh Chính** | **Lệnh chạy chính thức**: Cào tin, AI tổng hợp, bắn trọn vẹn bản tin vào kênh chính và lưu cache chống trùng 7 ngày. |

---

### Chi tiết các chế độ chạy:

#### 1. Chạy thử nghiệm toàn bộ luồng an toàn (Khuyên dùng khi dev):
```bash
# Trên máy Local:
npm run test:pipeline

# Hoặc khi đang chạy Docker:
docker exec ai_trend_watcher npm run test:pipeline
```
* Nếu có `GOOGLE_CHAT_TEST_WEBHOOK_URL`: Bản tin sẽ được gửi vào kênh Test riêng.
* Nếu chưa có `GOOGLE_CHAT_TEST_WEBHOOK_URL`: Hệ thống tự động chặn gửi và lưu bản tin xem trước tại `cache/digest_test_preview.md`.
* Cache `sent_items.json` được giữ nguyên để không ảnh hưởng đến lượt chạy thật lúc 9h sáng.

#### 2. Chạy thử nghiệm AI không gửi tin (Dry-Run):
```bash
npm run dry-run
# Trong Docker: docker exec ai_trend_watcher npm run dry-run
```

#### 3. Chạy chính thức ngay lập tức (Manual Trigger Production):
```bash
npm start
# Trong Docker: docker exec ai_trend_watcher node src/main.js
```

---

## ⏰ Tự Động Hóa Chạy Hàng Ngày (09:00 Sáng Mỗi Ngày)

### Cách 1: Chạy bằng Docker & Docker Compose (Khuyên dùng cho Server / Local)
**1. Khởi động hệ thống tự động chạy 09:00 sáng mỗi ngày:**
```bash
docker compose up -d
```
*(Cụm gồm container `ai_trend_watcher` và bộ lập lịch `digest_scheduler` (Ofelia) tự động kích hoạt `node src/main.js` đúng 09:00:00 sáng theo giờ Việt Nam).*

**2. Theo dõi log lập lịch:**
```bash
docker logs digest_scheduler --tail 20 -f
```

### Cách 2: Tự động đánh thức trên Windows khi máy đang Sleep (Windows Task Scheduler)
Trên máy Windows cá nhân, nếu máy bị Sleep hoặc tắt nguồn lúc 9h sáng:
* Hệ thống đã tích hợp sẵn script [scripts/trigger-digest.ps1](scripts/trigger-digest.ps1) đi kèm Windows Task Scheduler với 2 cờ:
  * `-WakeToRun`: Tự động đánh thức máy tính dậy lúc 09:00 AM để chạy.
  * `-StartWhenAvailable`: Tự động chạy bù bản tin ngay khi mở máy nếu lỡ khung giờ 9h.

### Cách 3: Chạy miễn phí bằng GitHub Actions
Dự án có sẵn file `.github/workflows/daily_digest.yml`. Thiết lập secret trong repo:
* `AI_API_KEY`: API key của Gemini hoặc OpenAI.
* `GOOGLE_CHAT_WEBHOOK_URL`: Webhook URL của Google Chat kênh chính.
Lịch chạy mặc định: **09:00 sáng mỗi ngày (giờ Việt Nam)**.

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
