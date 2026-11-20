import HoaDon from '@/models/HoaDon';

/** Hook tự động gửi Zalo (fire-and-forget) — lỗi Zalo không ảnh hưởng việc tạo hóa đơn. */
export function guiZaloTuDong(hoaDon: InstanceType<typeof HoaDon>) {
  (async () => {
    try {
      const { getCaiDatHoaDonLean } = await import('@/lib/cai-dat');
      const settings = await getCaiDatHoaDonLean();

      if (!settings.autoSendZalo) return;
      const kt = hoaDon.khachThue as unknown as { _id: unknown; hoTen: string; zaloUserId?: string };
      if (!kt?.zaloUserId) return;

      const { sendInvoiceMessage } = await import('@/lib/zalo');
      await sendInvoiceMessage({
        hoaDon: hoaDon.toObject() as unknown as Parameters<typeof sendInvoiceMessage>[0]['hoaDon'],
        khachThue: { ...kt, _id: String(kt._id) } as Parameters<typeof sendInvoiceMessage>[0]['khachThue'],
        settings: { ghiChuMacDinh: settings.ghiChuMacDinh, hienMaQR: settings.hienMaQR },
        trigger: 'auto',
        recipientType: 'tenant',
        recipientZaloUserId: kt.zaloUserId,
        phongId: String((hoaDon.phong as unknown as { _id?: unknown })?._id ?? hoaDon.phong),
        tenNhaTro: (settings as { tenNhaTro?: string }).tenNhaTro || 'Nhà trọ',
      });
    } catch (err) {
      console.error('Auto-send Zalo failed:', err);
    }
  })();
}

