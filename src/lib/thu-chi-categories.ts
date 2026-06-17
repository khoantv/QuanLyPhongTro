/**
 * Danh mục thu / chi khởi tạo sẵn của hệ thống.
 *
 * - `key`     : slug ổn định để các tính năng khác tham chiếu (không đổi).
 * - `heThong` : do hệ thống tạo (badge "Hệ thống").
 * - `choPhepSua` : cho phép sửa tên / xóa hay không.
 *
 * Hầu hết danh mục hệ thống không cho sửa; riêng điện / nước / wifi cho phép
 * vì giá nhà cung cấp thay đổi theo từng nhà trọ.
 */
export type LoaiThuChi = 'thu' | 'chi';

export interface DefaultCategory {
  key: string;
  ten: string;
  loai: LoaiThuChi;
  heThong: true;
  choPhepSua: boolean;
}

export const DEFAULT_THU_CATEGORIES: DefaultCategory[] = [
  { key: 'thu-tien-phong', ten: 'Thu tiền phòng', loai: 'thu', heThong: true, choPhepSua: false },
  { key: 'thu-tien-coc', ten: 'Thu tiền cọc', loai: 'thu', heThong: true, choPhepSua: false },
  { key: 'thu-tien-dich-vu', ten: 'Thu tiền dịch vụ', loai: 'thu', heThong: true, choPhepSua: false },
  { key: 'thu-no', ten: 'Thu nợ', loai: 'thu', heThong: true, choPhepSua: false },
  { key: 'thu-cong-them-hoa-don', ten: 'Thu cộng thêm hóa đơn', loai: 'thu', heThong: true, choPhepSua: false },
  { key: 'thu-tien-giuong', ten: 'Thu tiền giường', loai: 'thu', heThong: true, choPhepSua: false },
  { key: 'thu-tien-hang-thang', ten: 'Thu tiền hàng tháng', loai: 'thu', heThong: true, choPhepSua: false },
  { key: 'thu-tien-thang-dau-tien', ten: 'Thu tiền tháng đầu tiên', loai: 'thu', heThong: true, choPhepSua: false },
  { key: 'thu-tien-ket-thuc-hop-dong', ten: 'Thu tiền kết thúc hợp đồng', loai: 'thu', heThong: true, choPhepSua: false },
  { key: 'thu-tien-theo-chu-ky', ten: 'Thu tiền theo chu kỳ', loai: 'thu', heThong: true, choPhepSua: false },
  { key: 'thu-coc-giu-cho', ten: 'Thu cọc giữ chỗ', loai: 'thu', heThong: true, choPhepSua: false },
];

export const DEFAULT_CHI_CATEGORIES: DefaultCategory[] = [
  { key: 'chi-phi-quan-ly', ten: 'Chi phí quản lý', loai: 'chi', heThong: true, choPhepSua: false },
  { key: 'chi-hoan-tien-coc', ten: 'Chi hoàn tiền cọc', loai: 'chi', heThong: true, choPhepSua: false },
  { key: 'chi-tra-tien-dien', ten: 'Chi trả tiền điện', loai: 'chi', heThong: true, choPhepSua: true },
  { key: 'chi-tra-tien-nuoc', ten: 'Chi trả tiền nước', loai: 'chi', heThong: true, choPhepSua: true },
  { key: 'chi-tra-tien-wifi', ten: 'Chi trả tiền wifi', loai: 'chi', heThong: true, choPhepSua: true },
  { key: 'chi-tra-tien-cap-tv', ten: 'Chi trả tiền cáp TV', loai: 'chi', heThong: true, choPhepSua: false },
  { key: 'chi-giam-tru-hoa-don', ten: 'Chi giảm trừ hóa đơn', loai: 'chi', heThong: true, choPhepSua: false },
  { key: 'chi-hoan-tra-tien-ket-thuc-hop-dong', ten: 'Chi hoàn trả tiền kết thúc hợp đồng', loai: 'chi', heThong: true, choPhepSua: false },
];

export const DEFAULT_THU_CHI_CATEGORIES: DefaultCategory[] = [
  ...DEFAULT_THU_CATEGORIES,
  ...DEFAULT_CHI_CATEGORIES,
];
