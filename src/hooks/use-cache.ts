import { useState, useCallback } from 'react';

interface CacheConfig {
  key: string;
  duration?: number; // milliseconds, mặc định 5 phút
}

interface CachedData<T> {
  timestamp: number;
  data: T;
}

/**
 * Mốc thời gian dữ liệu thay đổi gần nhất (thêm/sửa/xóa qua API).
 * Cache nào lưu trước mốc này đều bị coi là cũ — nhờ vậy tạo hóa đơn ở trang Phòng
 * thì trang Hóa đơn, Thanh toán… cũng tự tải lại, không phụ thuộc tên khóa cache.
 */
const MOC_DU_LIEU_THAY_DOI = 'du-lieu-thay-doi-luc';

const docMocThayDoi = (): number => {
  try {
    return Number(sessionStorage.getItem(MOC_DU_LIEU_THAY_DOI)) || 0;
  } catch {
    return 0;
  }
};

/** Đánh dấu dữ liệu vừa thay đổi → mọi cache danh sách hiện có trở thành cũ */
export function danhDauDuLieuThayDoi() {
  try {
    sessionStorage.setItem(MOC_DU_LIEU_THAY_DOI, String(Date.now()));
  } catch {
    // sessionStorage không dùng được (chế độ riêng tư…) → bỏ qua, cache cũng không hoạt động
  }
}

let daCaiTheoDoiGhi = false;

/**
 * Bọc window.fetch: mọi request thêm/sửa/xóa (POST/PUT/PATCH/DELETE) tới /api/ thành công
 * sẽ tự đánh dấu dữ liệu thay đổi. Gọi một lần ở layout dashboard.
 */
export function caiTheoDoiGhiDuLieu() {
  if (daCaiTheoDoiGhi || typeof window === 'undefined') return;
  daCaiTheoDoiGhi = true;

  const fetchGoc = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await fetchGoc(input, init);
    try {
      const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const duongDan = new URL(url, window.location.origin);
      if (
        response.ok &&
        method !== 'GET' &&
        method !== 'HEAD' &&
        duongDan.origin === window.location.origin &&
        duongDan.pathname.startsWith('/api/') &&
        !duongDan.pathname.startsWith('/api/auth/')
      ) {
        danhDauDuLieuThayDoi();
      }
    } catch {
      // Không để lỗi theo dõi ảnh hưởng tới request thật
    }
    return response;
  };
}

export function useCache<T>(config: CacheConfig) {
  const { key, duration = 300000 } = config; // 5 phút mặc định
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Get cached data
  const getCache = useCallback((): T | null => {
    try {
      const cached = sessionStorage.getItem(key);
      if (!cached) return null;

      const parsed: CachedData<T> = JSON.parse(cached);
      const now = Date.now();

      // Còn hạn và được lưu sau lần thay đổi dữ liệu gần nhất
      if (now - parsed.timestamp < duration && parsed.timestamp > docMocThayDoi()) {
        return parsed.data;
      }

      // Cache hết hạn hoặc đã cũ, xóa luôn
      sessionStorage.removeItem(key);
      return null;
    } catch (error) {
      console.error('Error reading cache:', error);
      return null;
    }
  }, [key, duration]);

  // Set cached data
  const setCache = useCallback((data: T) => {
    try {
      const cacheData: CachedData<T> = {
        timestamp: Date.now(),
        data,
      };
      sessionStorage.setItem(key, JSON.stringify(cacheData));
    } catch (error) {
      console.error('Error setting cache:', error);
    }
  }, [key]);

  // Clear cache
  const clearCache = useCallback(() => {
    sessionStorage.removeItem(key);
  }, [key]);

  // Làm cũ toàn bộ cache dashboard (không cần biết tên khóa)
  const clearAllCaches = useCallback(() => {
    danhDauDuLieuThayDoi();
  }, []);

  return {
    getCache,
    setCache,
    clearCache,
    clearAllCaches,
    isRefreshing,
    setIsRefreshing,
  };
}
