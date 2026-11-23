/**
 * Giảm kích thước ảnh trên trình duyệt trước khi upload:
 * thu nhỏ cạnh dài nhất về tối đa `canhToiDa` px và nén JPEG.
 * Giữ nguyên file gốc khi: không phải ảnh raster (GIF động, SVG), ảnh đã nhỏ,
 * trình duyệt không hỗ trợ, hoặc bản nén không nhỏ hơn bản gốc.
 */

export const CANH_TOI_DA = 1600;
export const CHAT_LUONG = 0.82;
/** Ảnh nhỏ hơn mức này và không vượt kích thước tối đa thì không cần nén */
const BO_QUA_DUOI_BYTE = 300 * 1024;

const KHONG_NEN = new Set(['image/gif', 'image/svg+xml']);

export async function nenAnh(
  file: File,
  { canhToiDa = CANH_TOI_DA, chatLuong = CHAT_LUONG }: { canhToiDa?: number; chatLuong?: number } = {},
): Promise<File> {
  if (typeof window === 'undefined' || !file.type.startsWith('image/') || KHONG_NEN.has(file.type)) {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    // imageOrientation: tự xoay theo EXIF (ảnh chụp điện thoại)
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file; // định dạng trình duyệt không đọc được (vd. HEIC) → gửi nguyên bản
  }

  try {
    const { width, height } = bitmap;
    const tiLe = Math.min(1, canhToiDa / Math.max(width, height));
    if (tiLe === 1 && file.size <= BO_QUA_DUOI_BYTE) return file;

    const w = Math.round(width * tiLe);
    const h = Math.round(height * tiLe);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    // JPEG không có nền trong suốt → tô trắng (ảnh chụp màn hình PNG)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', chatLuong));
    if (!blob || blob.size >= file.size) return file;

    const ten = (file.name || 'anh').replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], ten, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
