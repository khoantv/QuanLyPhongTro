import {
  Refrigerator,
  WashingMachine,
  AirVent,
  Lamp,
  Table,
  Sofa,
  Armchair,
  Bed,
  DoorOpen,
  Tv,
  Microwave,
  Utensils,
  Key,
  LampDesk,
  Wifi,
  Fan,
  Package,
  Boxes,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Danh sách icon dùng cho tài sản. Key được lưu trong DB,
 * giúp đổi icon library mà không phá data cũ.
 */
export const TAI_SAN_ICONS: Array<{ key: string; label: string; Icon: LucideIcon }> = [
  { key: 'fridge', label: 'Tủ lạnh', Icon: Refrigerator },
  { key: 'washer', label: 'Máy giặt', Icon: WashingMachine },
  { key: 'ac', label: 'Điều hòa', Icon: AirVent },
  { key: 'fan', label: 'Quạt', Icon: Fan },
  { key: 'lamp', label: 'Đèn', Icon: Lamp },
  { key: 'lamp-desk', label: 'Đèn bàn', Icon: LampDesk },
  { key: 'table', label: 'Bàn', Icon: Table },
  { key: 'desk', label: 'Bàn làm việc', Icon: LampDesk },
  { key: 'sofa', label: 'Ghế sofa', Icon: Sofa },
  { key: 'chair', label: 'Ghế', Icon: Armchair },
  { key: 'bed', label: 'Giường', Icon: Bed },
  { key: 'wardrobe', label: 'Tủ quần áo', Icon: Boxes },
  { key: 'kitchen', label: 'Bếp', Icon: Utensils },
  { key: 'microwave', label: 'Lò vi sóng', Icon: Microwave },
  { key: 'tv', label: 'TV', Icon: Tv },
  { key: 'wifi', label: 'Router WiFi', Icon: Wifi },
  { key: 'door', label: 'Cửa', Icon: DoorOpen },
  { key: 'key', label: 'Chìa khóa', Icon: Key },
  { key: 'package', label: 'Khác', Icon: Package },
];

const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  TAI_SAN_ICONS.map(({ key, Icon }) => [key, Icon])
);

export function getTaiSanIcon(key: string | undefined | null): LucideIcon {
  if (!key) return Package;
  return ICON_MAP[key] || Package;
}

export function getTaiSanIconLabel(key: string | undefined | null): string {
  const found = TAI_SAN_ICONS.find(i => i.key === key);
  return found?.label || 'Khác';
}
