// src/components/CoverUpload.tsx
// Drag-and-drop cover image uploader for the admin anime form
'use client';
import { useState, useRef } from 'react';
import Image from 'next/image';
import { api } from '@/lib/api';

interface Props {
  animeId: string;
  currentUrl?: string | null;
  onSuccess: (url: string) => void;
}

export default function CoverUpload({ animeId, currentUrl, onSuccess }: Props) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Only image files are accepted');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File must be under 5MB');
      return;
    }

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    setError('');

    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post(`/upload/cover/${animeId}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = data.data?.urls?.md ?? data.urls?.md;
      onSuccess(url);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Upload failed');
      setPreview(currentUrl ?? null);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        style={{
          width: 160, height: 240, borderRadius: 10, overflow: 'hidden',
          border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
          background: dragOver ? 'rgba(224,64,176,0.05)' : 'var(--bg-hover)',
          cursor: 'pointer', position: 'relative', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        {preview ? (
          <Image src={preview} alt="Cover preview" fill style={{ objectFit: 'cover' }} sizes="160px" />
        ) : (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🖼</div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
              Click or drag to upload cover
            </p>
          </div>
        )}

        {uploading && (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}
      </div>

      {error && (
        <p style={{ fontSize: 11, color: '#ef4444', marginTop: 6 }}>{error}</p>
      )}
      <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
        JPEG / PNG / WebP · max 5MB
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
