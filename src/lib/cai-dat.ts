import 'server-only';
import { cache } from 'react';
import dbConnect from './mongodb';
import CaiDatHoaDon, { ICaiDatHoaDon } from '@/models/CaiDatHoaDon';

/**
 * Lấy singleton CaiDatHoaDon, tự tạo defaults nếu chưa có.
 * `cache()` của React đảm bảo trong cùng 1 request chỉ query DB 1 lần.
 */
export const getCaiDatHoaDon = cache(async (): Promise<ICaiDatHoaDon> => {
  await dbConnect();
  const doc = await CaiDatHoaDon.findOneAndUpdate(
    { singleton: true },
    { $setOnInsert: { singleton: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return doc as ICaiDatHoaDon;
});

/**
 * Như trên nhưng trả về plain object (lean), dùng khi không cần mongoose document.
 */
export const getCaiDatHoaDonLean = cache(async () => {
  await dbConnect();
  const doc = await CaiDatHoaDon.findOneAndUpdate(
    { singleton: true },
    { $setOnInsert: { singleton: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return doc as unknown as ICaiDatHoaDon;
});
