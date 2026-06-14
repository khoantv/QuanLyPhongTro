/**
 * Render template tin Zalo OA dạng card hóa đơn.
 * Trả về object payload sẵn sàng POST đến openapi.zalo.me message/transaction.
 *
 * Layout (mockup ảnh):
 * - Lời chào: "Xin chào {hoTen}"
 * - Tiêu đề: "Hóa đơn tiền thuê nhà tháng MM/YYYY từ nhà trọ {ten}"
 * - Bảng: mã HD, mã thanh toán, tiền phòng-cọc, điện, nước, dịch vụ, cộng/giảm, tổng
 * - Hạn thanh toán
 * - Ghi chú (nếu có)
 * - CTA: "XÁC NHẬN THANH TOÁN" → link tới /hoa-don/{id}
 */

interface HoaDonForTemplate {
  _id: string;
  maHoaDon: string;
  thang: number;
  nam: number;
  tienPhong: number;
  tienDien: number;
  soDien?: number;
  chiSoDienBanDau?: number;
  chiSoDienCuoiKy?: number;
  tienNuoc: number;
  soNuoc?: number;
  chiSoNuocBanDau?: number;
  chiSoNuocCuoiKy?: number;
  phiDichVu?: Array<{ ten: string; gia: number }>;
  tongTien: number;
  hanThanhToan: Date | string;
  ghiChu?: string;
}

interface KhachThueForTemplate {
  hoTen: string;
  zaloUserId?: string;
}

interface SettingsForTemplate {
  ghiChuMacDinh?: string;
  hienMaQR?: boolean;
}

interface RenderOptions {
  baseUrl: string; // vd "https://qlpt.vercel.app"
  tenNhaTro?: string; // tên hiển thị OA, default "Phòng trọ"
}

function fmtVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(Math.round(amount)) + 'đ';
}

function fmtDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export interface ZaloMessagePayload {
  recipient: { user_id: string };
  message: {
    attachment: {
      type: 'template';
      payload: {
        template_type: 'transaction_order';
        language: 'VI';
        elements: Array<Record<string, unknown>>;
        buttons: Array<{
          title: string;
          image_icon?: string;
          type: 'oa.open.url' | 'oa.query.hide' | 'oa.query.show';
          payload: { url?: string } | string;
        }>;
      };
    };
  };
}

export function renderInvoiceCard(
  hoaDon: HoaDonForTemplate,
  khachThue: KhachThueForTemplate,
  settings: SettingsForTemplate,
  opts: RenderOptions
): ZaloMessagePayload {
  const monthStr = String(hoaDon.thang).padStart(2, '0');
  const yearStr = String(hoaDon.nam);

  // Diễn giải điện: "chỉ số cũ - mới Nsố x giá Đtổng"
  const dienDetail = hoaDon.chiSoDienBanDau != null && hoaDon.chiSoDienCuoiKy != null
    ? `${hoaDon.chiSoDienBanDau}-${hoaDon.chiSoDienCuoiKy}` + (hoaDon.soDien != null ? ` ${hoaDon.soDien}x` : '')
    : '';
  const nuocDetail = hoaDon.chiSoNuocBanDau != null && hoaDon.chiSoNuocCuoiKy != null
    ? `${hoaDon.chiSoNuocBanDau}-${hoaDon.chiSoNuocCuoiKy}` + (hoaDon.soNuoc != null ? ` ${hoaDon.soNuoc}x` : '')
    : '';

  const tongDichVu = (hoaDon.phiDichVu || []).reduce((s, p) => s + (p.gia || 0), 0);
  const ghiChu = (hoaDon.ghiChu?.trim() || settings.ghiChuMacDinh?.trim() || '').slice(0, 500);

  const elements: Array<Record<string, unknown>> = [
    {
      type: 'header',
      content: `Hóa đơn tiền thuê nhà tháng ${monthStr}/${yearStr} từ nhà trọ ${opts.tenNhaTro || 'Phòng trọ'}`,
    },
    { type: 'text', align: 'left', content: `Xin chào ${khachThue.hoTen},` },
    {
      type: 'table',
      content: [
        { key: 'Mã hóa đơn', value: `#${hoaDon.maHoaDon}` },
        { key: 'Mã thanh toán', value: `RT${hoaDon.maHoaDon}` },
        { key: 'Tiền phòng', value: fmtVND(hoaDon.tienPhong) },
        { key: 'Tiền điện', value: `${dienDetail} ${fmtVND(hoaDon.tienDien)}`.trim() },
        { key: 'Tiền nước', value: `${nuocDetail} ${fmtVND(hoaDon.tienNuoc)}`.trim() },
        { key: 'Dịch vụ khác', value: fmtVND(tongDichVu) },
        { key: 'Tổng tiền', value: fmtVND(hoaDon.tongTien) },
      ],
    },
    {
      type: 'text', align: 'left',
      content: `Hạn thanh toán hóa đơn trước ngày ${fmtDate(hoaDon.hanThanhToan)}.`,
    },
  ];

  if (ghiChu) {
    elements.push({ type: 'text', align: 'left', content: `Ghi chú: ${ghiChu}` });
  }

  return {
    recipient: { user_id: khachThue.zaloUserId || '' },
    message: {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'transaction_order',
          language: 'VI',
          elements,
          buttons: [
            {
              title: 'XÁC NHẬN THANH TOÁN',
              type: 'oa.open.url',
              payload: { url: `${opts.baseUrl.replace(/\/$/, '')}/hoa-don/${hoaDon._id}` },
            },
          ],
        },
      },
    },
  };
}
