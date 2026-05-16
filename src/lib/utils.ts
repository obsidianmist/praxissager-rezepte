import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  return crypto.randomUUID();
}

export async function fileToArrayBuffer(file: File | Blob): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}

export function arrayBufferToBlob(buffer: ArrayBuffer, type: string): Blob {
  return new Blob([buffer], { type });
}

export function createBlobUrl(buffer: ArrayBuffer, type: string): string {
  const blob = arrayBufferToBlob(buffer, type);
  return URL.createObjectURL(blob);
}

export async function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer as any]);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function base64ToArrayBuffer(base64: string): Promise<ArrayBuffer> {
  const res = await fetch(`data:application/octet-stream;base64,${base64}`);
  return await res.arrayBuffer();
}

export async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file); // Fallback
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const compressedFile = new File([blob], file.name, {
            type: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        }, file.type === 'image/png' ? 'image/png' : 'image/jpeg', quality);
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
}
