/**
 * Khung giờ Zalo OA cho phép gửi tin chủ động: 06:00 - 22:00 (giờ VN).
 */
const ALLOWED_START_HOUR = 6;
const ALLOWED_END_HOUR = 22;
const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

function getVietnamHour(date: Date = new Date()): number {
  // Intl.DateTimeFormat với timeZone trả về giờ địa phương của timezone đó
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: VN_TIMEZONE,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hourPart = parts.find(p => p.type === 'hour');
  return hourPart ? parseInt(hourPart.value, 10) : new Date().getHours();
}

export function isWithinAllowedHours(date: Date = new Date()): boolean {
  const hour = getVietnamHour(date);
  return hour >= ALLOWED_START_HOUR && hour < ALLOWED_END_HOUR;
}

/**
 * Trả về Date là thời điểm sớm nhất tiếp theo trong khung 06:00 VN.
 * Nếu hiện tại đang trong khung → trả về now.
 */
export function nextAllowedTime(from: Date = new Date()): Date {
  if (isWithinAllowedHours(from)) return from;

  // Lấy giờ/phút hiện tại theo VN
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: VN_TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(from).filter(p => p.type !== 'literal').map(p => [p.type, p.value])
  );
  const vnYear = parseInt(parts.year, 10);
  const vnMonth = parseInt(parts.month, 10);
  const vnDay = parseInt(parts.day, 10);
  const vnHour = parseInt(parts.hour, 10);

  // Nếu trước 6h sáng cùng ngày VN → tới 6h sáng cùng ngày
  // Nếu sau 22h tối → tới 6h sáng hôm sau VN
  const targetDayOffset = vnHour < ALLOWED_START_HOUR ? 0 : 1;

  // Tạo ISO string giờ VN rồi cộng offset
  // VN là UTC+7
  const targetDate = new Date(Date.UTC(vnYear, vnMonth - 1, vnDay + targetDayOffset, ALLOWED_START_HOUR - 7, 0, 0));
  return targetDate;
}
