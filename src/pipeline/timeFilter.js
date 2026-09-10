/**
 * Lọc bài viết theo cửa sổ thời gian chính xác 24h (Sliding Time Window)
 * Ví dụ: Nếu chạy lúc 07:00 ngày 8/9, chỉ lấy bài từ 07:00 ngày 7/9 đến 06:00 ngày 8/9
 * 
 * @param {Array} items - Danh sách các bài cào về
 * @param {number} lookbackHours - Số giờ lùi về quá khứ (mặc định 24h)
 * @param {number} bufferHours - Độ trễ buffer an toàn (mặc định 1h theo yêu cầu)
 * @returns {Array} Danh sách các bài nằm đúng trong khung giờ
 */
export function filterByTimeWindow(items, lookbackHours = 24, bufferHours = 1) {
  const now = Date.now();
  // Thời điểm kết thúc: hiện tại trừ đi buffer (ví dụ 1 tiếng trước)
  const endTimestamp = now - (bufferHours * 60 * 60 * 1000);
  // Thời điểm bắt đầu: lùi đúng 24h từ endTimestamp
  const startTimestamp = endTimestamp - (lookbackHours * 60 * 60 * 1000);

  const startDateStr = new Date(startTimestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const endDateStr = new Date(endTimestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

  console.log(`[TimeFilter] Áp dụng cửa sổ thời gian 24h: [${startDateStr}] ➔ [${endDateStr}]`);

  const filtered = items.filter(item => {
    if (!item.publishedAt) return false;
    const itemTime = new Date(item.publishedAt).getTime();
    if (isNaN(itemTime)) return false;

    // Chỉ nhận bài viết có thời gian xuất bản trong khung [startTimestamp, endTimestamp]
    return itemTime >= startTimestamp && itemTime <= endTimestamp;
  });

  console.log(`[TimeFilter] Tổng ${items.length} bài cào được ➔ Còn lại ${filtered.length} bài nằm đúng khung giờ 24h.`);

  // Nếu một nguồn có ít bài do chu kỳ xuất bản chậm (như podcast tuần), fallback giữ bài trong 72h
  if (filtered.length < 5) {
    console.warn(`[TimeFilter] Số lượng bài trong 24h quá ít (${filtered.length} bài). Mở rộng nhẹ cửa sổ sang 48h để đảm bảo đủ dữ liệu phân tích...`);
    const relaxedStart = endTimestamp - (48 * 60 * 60 * 1000);
    return items.filter(item => {
      const itemTime = new Date(item.publishedAt).getTime();
      return !isNaN(itemTime) && itemTime >= relaxedStart && itemTime <= endTimestamp;
    });
  }

  return filtered;
}
