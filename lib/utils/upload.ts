import { compressImage, validateImageSize, getFileSizeInMB } from './imageValidation';

export type UploadResult = {
  url: string;
  key: string;
};

export async function uploadImage(file: File): Promise<UploadResult> {
  // Comprimir imagen si es muy grande
  let fileToUpload = file;
  
  if (!validateImageSize(file, 4)) {
    console.log(`Comprimiendo imagen: ${getFileSizeInMB(file).toFixed(2)}MB`);
    fileToUpload = await compressImage(file, 2);
    console.log(`Imagen comprimida: ${getFileSizeInMB(fileToUpload).toFixed(2)}MB`);
  }

  const formData = new FormData();
  formData.append('file', fileToUpload);

  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al subir imagen');
  }

  const data = await response.json();
  return {
    url: data?.url ?? '',
    key: data?.key ?? '',
  };
}

export async function uploadMultipleImages(files: File[]): Promise<UploadResult[]> {
  const uploadPromises = files.map((file) => uploadImage(file));
  return Promise.all(uploadPromises);
}

/** Sube un archivo de video (mp4, webm, etc.) a /api/upload. Sin compresión. */
export async function uploadVideo(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as { error?: string }).error || 'Error al subir video');
  }
  const data = (await response.json()) as { url: string };
  return data.url;
}


