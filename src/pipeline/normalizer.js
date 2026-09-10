import crypto from 'crypto';

/**
 * Chuẩn hóa một item từ bất kỳ nguồn nào thành cấu trúc đồng nhất
 */
export function createFeedItem({
  id,
  source,
  title,
  url,
  author = '',
  content = '',
  publishedAt,
  score = 0,
  metadata = {}
}) {
  const cleanUrl = (url || '').trim();
  const generatedId = id || crypto.createHash('md5').update(cleanUrl || (title + author)).digest('hex');

  // Rút gọn nội dung để tối ưu token cho AI Agent nhưng vẫn giữ đủ ngữ cảnh kỹ thuật
  const cleanContent = (content || '')
    .replace(/<[^>]*>/g, ' ') // Xóa HTML tags
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 4000);

  return {
    id: generatedId,
    source, // 'x' | 'youtube' | 'reddit' | 'blogs' | 'github' | 'google_news'
    title: (title || 'Untitled').trim().replace(/\n/g, ' '),
    url: cleanUrl,
    author: (author || '').trim(),
    content: cleanContent,
    publishedAt: publishedAt || new Date().toISOString(),
    score: Number(score) || 0,
    metadata
  };
}
