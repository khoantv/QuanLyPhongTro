import DanhMucThuChi from '@/models/DanhMucThuChi';
import { DEFAULT_THU_CHI_CATEGORIES } from './thu-chi-categories';

/**
 * Đảm bảo các danh mục thu / chi hệ thống đã tồn tại trong DB.
 * Idempotent — chạy lại nhiều lần không tạo bản trùng (dựa trên `key` unique).
 * Gọi ở đầu các route danh mục / phiếu thu chi.
 */
export async function ensureDefaultThuChiCategories(): Promise<void> {
  const existing = await DanhMucThuChi.find({ heThong: true }).select('key').lean();
  const existingKeys = new Set(existing.map((d) => (d as { key?: string }).key).filter(Boolean));

  const missing = DEFAULT_THU_CHI_CATEGORIES.filter((c) => !existingKeys.has(c.key));
  if (missing.length === 0) return;

  const docs = missing.map((c, i) => ({
    ten: c.ten,
    loai: c.loai,
    key: c.key,
    heThong: true,
    choPhepSua: c.choPhepSua,
    thuTu: i,
  }));

  try {
    await DanhMucThuChi.insertMany(docs, { ordered: false });
  } catch {
    // Bỏ qua lỗi trùng key khi nhiều request seed song song.
  }
}
