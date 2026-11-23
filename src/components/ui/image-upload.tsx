'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, Image as ImageIcon, Loader2, ClipboardPaste } from 'lucide-react';
import { toast } from 'sonner';
import { nenAnh } from '@/lib/nen-anh';
import { useDanAnh } from '@/hooks/use-dan-anh';

interface ImageUploadProps {
  imageUrl: string;
  onImageChange: (imageUrl: string) => void;
  className?: string;
  label?: string;
  placeholder?: string;
  /** Cho phép dán ảnh từ clipboard (Ctrl/⌘+V hoặc nút "Dán ảnh"). Mặc định bật. */
  enablePaste?: boolean;
}

export function ImageUpload({
  imageUrl,
  onImageChange,
  className = '',
  label = 'Ảnh',
  placeholder = 'Chọn ảnh',
  enablePaste = true,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn file ảnh');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', await nenAnh(file)); // thu nhỏ + nén trước khi gửi

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      // /api/upload trả link Cloudinary trong secure_url
      const url: string | undefined = result?.data?.secure_url || result?.data?.url;
      if (result.success && url) {
        onImageChange(url);
        toast.success('Upload ảnh thành công');
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Có lỗi xảy ra khi upload ảnh');
    } finally {
      setUploading(false);
      // Reset input
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    await uploadFile(files[0]);
  };

  // Dán ảnh: ô chỉ nhận một ảnh → lấy ảnh đầu tiên (thay ảnh cũ nếu có)
  const { ref, danTuNut } = useDanAnh((files) => {
    if (!uploading && files[0]) void uploadFile(files[0]);
  }, enablePaste);

  const handleRemove = () => {
    onImageChange('');
  };

  return (
    <div ref={ref} className={`space-y-2 ${className}`}>
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        {label}
      </label>

      <div className="space-y-2">
        {imageUrl ? (
          <div className="relative">
            <img
              src={imageUrl}
              alt="Uploaded image"
              className="w-full h-48 object-cover rounded-lg border"
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={handleRemove}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            className="w-full h-48 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 transition-colors"
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">Đang upload...</p>
              </>
            ) : (
              <>
                <ImageIcon className="h-8 w-8 text-gray-400" />
                <p className="mt-2 text-sm text-gray-500">{placeholder}</p>
                <p className="text-xs text-gray-400">
                  {enablePaste ? 'Click để chọn ảnh hoặc nhấn Ctrl/⌘+V để dán' : 'Click để chọn ảnh'}
                </p>
              </>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {!imageUrl && !uploading && (
          <div className={enablePaste ? 'grid grid-cols-2 gap-2' : ''}>
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              Chọn ảnh
            </Button>
            {enablePaste && (
              <Button type="button" variant="outline" onClick={danTuNut} className="w-full">
                <ClipboardPaste className="h-4 w-4 mr-2" />
                Dán ảnh
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
