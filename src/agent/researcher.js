import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { SYSTEM_PROMPT, buildUserPrompt } from './prompts.js';

export class AIResearcher {
  constructor() {
    this.provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
    this.apiKey = process.env.AI_API_KEY || '';
    // Mặc định luôn là gemini-3.8-flash theo yêu cầu
    this.model = process.env.AI_MODEL || (this.provider === 'gemini' ? 'gemini-3.8-flash' : 'gpt-4o-mini');
  }

  /**
   * Phân tích và sinh bản tin digest từ danh sách feed items
   * @param {Array} items - Danh sách Top K items
   * @returns {Promise<string>} Nội dung bản tin đã định dạng
   */
  async generateDigest(items) {
    if (!this.apiKey) {
      throw new Error('Chưa cấu hình AI_API_KEY trong file .env. Vui lòng thêm API Key trước khi chạy.');
    }

    if (!items || items.length === 0) {
      return 'Không có dữ liệu bài viết mới nào để tổng hợp hôm nay.';
    }

    const todayStr = new Date().toLocaleDateString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    console.log(`[AI Researcher] Bắt đầu gọi AI (${this.provider.toUpperCase()}) để tổng hợp ${items.length} bài viết...`);

    const userPrompt = buildUserPrompt(items, todayStr);

    if (this.provider === 'gemini' || this.apiKey.startsWith('AIza')) {
      return await this.callGeminiWithFallback(userPrompt, todayStr);
    } else {
      return await this.callOpenAI(userPrompt);
    }
  }

  /**
   * Gọi Google Gemini API:
   * 1. Ưu tiên mặc định: gemini-3.8-flash
   * 2. Nếu 503 (quá tải) hoặc 429 (quota rate-limit): tự động fallback qua gemini-3.7-flash, gemini-3.5-flash
   * 3. Giới hạn thinkingBudget để không bị suy nghĩ ngầm nuốt hết token (tránh bị cụt chữ)
   */
  async callGeminiWithFallback(userPrompt, dateStr) {
    const modelsToTry = [
      this.model || 'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.5-flash'
    ].filter((m, idx, arr) => m && arr.indexOf(m) === idx);

    let lastError = null;

    for (const modelName of modelsToTry) {
      console.log(`[AI Researcher] Đang kích hoạt model: [${modelName}]...`);

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const text = await this.executeGeminiRequest(modelName, userPrompt, dateStr);
          console.log(`[AI Researcher] Model [${modelName}] tổng hợp thành công (${text.length} ký tự).`);
          return text;
        } catch (err) {
          lastError = err;
          const isRateLimitOrBusy = err.message.includes('503') || err.message.includes('429') || err.message.includes('quota');

          if (isRateLimitOrBusy && attempt < 2) {
            console.warn(`[AI Researcher] Model [${modelName}] bận (503/429). Thử lại sau 2s...`);
            await new Promise(r => setTimeout(r, 2000));
          } else {
            console.warn(`[AI Researcher] Chuyển tiếp từ [${modelName}] sang model kế tiếp do: ${err.message.slice(0, 100)}...`);
            break;
          }
        }
      }
    }

    // Fallback cuối cùng: Lưu toàn bộ prompt vào cache/pending_prompt.txt
    console.warn('\n[AI Researcher] TẤT CẢ API MODELS ĐỀU BẬN. Kích hoạt fallback lưu prompt cục bộ...');
    const fallbackPath = path.resolve('cache/pending_prompt.txt');
    const fullContent = `${SYSTEM_PROMPT.replace('{DATE}', dateStr)}\n\n${userPrompt}`;
    fs.writeFileSync(fallbackPath, fullContent, 'utf-8');
    console.log(`[AI Researcher] Đã lưu prompt chờ vào: ${fallbackPath}`);

    throw new Error(`Các model API đang bị rate limit/quá tải. Đã lưu nội dung vào cache/pending_prompt.txt để xử lý tiếp.`);
  }

  async executeGeminiRequest(modelName, userPrompt, dateStr) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${SYSTEM_PROMPT.replace('{DATE}', dateStr)}\n\n${userPrompt}` }]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8192,
        thinkingConfig: {
          thinkingBudget: 512 // Giới hạn thinking budget 512 tokens để dành trọn vẹn output cho nội dung bản tin
        }
      }
    };

    // Timeout 90s cho mỗi request gọi model để chống treo tiến trình
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 90000);

    let res;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (fetchErr) {
      if (fetchErr.name === 'AbortError') {
        throw new Error(`Gemini API Request timed out sau 90s cho model [${modelName}]`);
      }
      throw fetchErr;
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Gemini API Error (${res.status}): ${errorText}`);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map(p => p.text || '').join('');

    if (!text) {
      throw new Error('Gemini không trả về nội dung kết quả hợp lệ.');
    }

    return text;
  }

  /**
   * Gọi OpenAI hoặc OpenAI-compatible API (DeepSeek, Groq, OpenRouter...)
   */
  async callOpenAI(userPrompt) {
    const openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
      timeout: 90000 // Timeout 90s chống treo
    });

    const completion = await openai.chat.completions.create({
      model: this.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 4000
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI không trả về kết quả hợp lệ.');
    }

    console.log(`[AI Researcher] Đã tổng hợp thành công bản tin (${content.length} ký tự).`);
    return content;
  }
}
