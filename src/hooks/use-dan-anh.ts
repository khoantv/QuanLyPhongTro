'use client';

import { useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';

/**
 * Dán ảnh từ clipboard (Ctrl/⌘+V) vào các ô tải ảnh.
 *
 * Chỉ có một listener `paste` cho cả trang. Khi clipboard có ảnh, ảnh được giao cho đúng MỘT ô:
 * ô người dùng vừa rê chuột / bấm / focus gần nhất; nếu chưa tương tác ô nào thì ô được
 * mở (mount) sau cùng — thường là ô trong dialog đang mở. Dán chữ vào ô nhập liệu không bị ảnh hưởng.
 */

type DichDan = {
  nhanAnh: (files: File[]) => void;
  phanTu: () => HTMLElement | null;
  moLuc: number;
  tuongTacLuc: number;
};

const dsDich = new Map<number, DichDan>();
let idTiepTheo = 1;
let daCaiListener = false;

/** Lấy các file ảnh trong dữ liệu clipboard của sự kiện paste */
export function layAnhTuDataTransfer(data: DataTransfer | null): File[] {
  if (!data) return [];
  return Array.from(data.items)
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((f): f is File => !!f);
}

/** Đặt tên dễ phân biệt cho ảnh dán (clipboard thường đặt tên "image.png") */
export function datTenAnhDan(file: File, i = 0): File {
  if (file.name && file.name !== 'image.png') return file;
  const duoi = file.type.split('/')[1] || 'png';
  return new File([file], `anh-dan-${Date.now()}${i ? `-${i}` : ''}.${duoi}`, { type: file.type });
}

const chonDich = (): DichDan | null => {
  let tot: DichDan | null = null;
  for (const d of dsDich.values()) {
    const el = d.phanTu();
    // Bỏ qua ô đang bị ẩn (không còn trong trang hoặc không hiển thị)
    if (el && (!el.isConnected || el.getClientRects().length === 0)) continue;
    if (!tot || d.tuongTacLuc > tot.tuongTacLuc || (d.tuongTacLuc === tot.tuongTacLuc && d.moLuc > tot.moLuc)) {
      tot = d;
    }
  }
  return tot;
};

const onPaste = (event: ClipboardEvent) => {
  const files = layAnhTuDataTransfer(event.clipboardData);
  if (!files.length) return;
  const dich = chonDich();
  if (!dich) return;
  event.preventDefault();
  dich.nhanAnh(files.map((f, i) => datTenAnhDan(f, i)));
};

/** Đọc ảnh trong clipboard qua Clipboard API — dùng cho nút "Dán ảnh" */
export async function docAnhTuClipboard(): Promise<File[]> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.read) {
    toast.error('Trình duyệt không hỗ trợ đọc clipboard — hãy nhấn Ctrl/⌘+V');
    return [];
  }
  try {
    const items = await navigator.clipboard.read();
    const files: File[] = [];
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith('image/'));
      if (type) files.push(datTenAnhDan(new File([await item.getType(type)], 'image.png', { type }), files.length));
    }
    if (!files.length) toast.error('Clipboard không có ảnh. Hãy chụp hoặc sao chép ảnh trước.');
    return files;
  } catch (error) {
    console.error('Clipboard read error:', error);
    toast.error('Không đọc được clipboard — hãy cho phép quyền truy cập hoặc nhấn Ctrl/⌘+V');
    return [];
  }
}

/**
 * Đăng ký một ô tải ảnh nhận ảnh dán. Gắn `ref` vào phần tử bao quanh ô
 * (để biết người dùng đang tương tác ô nào) và gọi `danTuNut` từ nút "Dán ảnh".
 */
export function useDanAnh<T extends HTMLElement = HTMLDivElement>(
  nhanAnh: (files: File[]) => void,
  enabled = true,
) {
  const ref = useRef<T>(null);
  const nhanAnhRef = useRef(nhanAnh);
  useEffect(() => {
    nhanAnhRef.current = nhanAnh;
  }, [nhanAnh]);

  useEffect(() => {
    if (!enabled) return;
    if (!daCaiListener) {
      document.addEventListener('paste', onPaste);
      daCaiListener = true;
    }
    const id = idTiepTheo++;
    const dich: DichDan = {
      nhanAnh: (files) => nhanAnhRef.current(files),
      phanTu: () => ref.current,
      moLuc: id,
      tuongTacLuc: 0,
    };
    dsDich.set(id, dich);

    const el = ref.current;
    const danhDau = () => {
      dich.tuongTacLuc = Date.now();
    };
    el?.addEventListener('pointerenter', danhDau);
    el?.addEventListener('pointerdown', danhDau);
    el?.addEventListener('focusin', danhDau);
    return () => {
      el?.removeEventListener('pointerenter', danhDau);
      el?.removeEventListener('pointerdown', danhDau);
      el?.removeEventListener('focusin', danhDau);
      dsDich.delete(id);
    };
  }, [enabled]);

  const danTuNut = useCallback(async () => {
    const files = await docAnhTuClipboard();
    if (files.length) nhanAnhRef.current(files);
  }, []);

  return { ref, danTuNut };
}
