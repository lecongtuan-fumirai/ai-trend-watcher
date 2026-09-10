/**
 * Lọc và xếp hạng: Chỉ giữ lại đúng Top K bài viết tốt nhất cho mỗi nguồn
 * @param {Array} items - Danh sách các feed items
 * @param {number} topK - Số lượng tối đa mỗi nguồn (mặc định 10)
 * @returns {Array} Danh sách đã lọc và sắp xếp
 */
export function rankAndFilterTopK(items, topK = 10) {
  const groupedBySource = {};

  for (const item of items) {
    if (!item.url) continue;
    if (!groupedBySource[item.source]) {
      groupedBySource[item.source] = [];
    }
    groupedBySource[item.source].push(item);
  }

  const selectedItems = [];

  for (const [source, list] of Object.entries(groupedBySource)) {
    // Sắp xếp theo:
    // 1. Điểm score (likes, upvotes, stars) giảm dần
    // 2. Nếu điểm bằng nhau, sắp xếp theo thời gian mới nhất (publishedAt)
    const sorted = [...list].sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const timeA = new Date(a.publishedAt).getTime() || 0;
      const timeB = new Date(b.publishedAt).getTime() || 0;
      return timeB - timeA;
    });

    const topItems = sorted.slice(0, topK);
    console.log(`[Ranker] Nguồn [${source}]: Thu thập ${list.length} bài, chọn lọc Top ${topItems.length} bài tốt nhất.`);
    selectedItems.push(...topItems);
  }

  return selectedItems;
}
