'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/** "14300500" → "14.300.500" */
export const dinhDangTien = (n: number | null | undefined) =>
  n === null || n === undefined || !Number.isFinite(n) ? '' : Math.round(n).toLocaleString('vi-VN');

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number | null;
  onChange: (value: number | null) => void;
  /** Hậu tố hiển thị cuối ô, mặc định "đ" */
  donVi?: string;
};

/**
 * Ô nhập số tiền hiển thị dạng 14.300.500 đ khi gõ. Giá trị trả ra là số (hoặc null khi để trống).
 * Giữ vị trí con trỏ khi chèn dấu chấm, chỉ nhận chữ số.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, Props>(function MoneyInput(
  { value, onChange, donVi = 'đ', className, ...props },
  ref,
) {
  const innerRef = React.useRef<HTMLInputElement | null>(null);
  const caretRef = React.useRef<number | null>(null);
  const hienThi = dinhDangTien(value);

  React.useLayoutEffect(() => {
    // Đặt lại con trỏ sau khi chuỗi được định dạng lại: giữ nguyên số chữ số đứng trước con trỏ
    const el = innerRef.current;
    if (el && caretRef.current !== null && document.activeElement === el) {
      let soChuSo = caretRef.current;
      let pos = 0;
      while (pos < hienThi.length && soChuSo > 0) {
        if (/\d/.test(hienThi[pos])) soChuSo--;
        pos++;
      }
      el.setSelectionRange(pos, pos);
    }
    caretRef.current = null;
  }, [hienThi]);

  return (
    <div className="relative">
      <input
        {...props}
        ref={(el) => {
          innerRef.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={hienThi}
        onChange={(e) => {
          const raw = e.target.value;
          const caret = e.target.selectionStart ?? raw.length;
          caretRef.current = raw.slice(0, caret).replace(/\D/g, '').length;
          const so = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 15);
          onChange(so ? Number(so) : null);
        }}
        className={cn(
          'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 pr-9 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
          'text-right tabular-nums',
          className,
        )}
      />
      {donVi && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
          {donVi}
        </span>
      )}
    </div>
  );
});
