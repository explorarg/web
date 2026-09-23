export function validateImageSize(file: File, maxSizeMB: number = 5): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
}

export function getFileSizeInMB(file: File): number {
  return file.size / (1024 * 1024);
}

export async function compressImage(file: File, maxSizeMB: number = 2): Promise<File> {
  // Si la imagen es menor al límite, retornarla sin comprimir
  if (validateImageSize(file, maxSizeMB)) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    
    reader.onload = (event) => {
      const img = document.createElement('img');
      img.src = event.target?.result as string;
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Calcular nueva dimensión manteniendo aspecto
        const maxDimension = 2560;
        if (width > height && width > maxDimension) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else if (height > maxDimension) {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              reject(new Error('Error al comprimir imagen'));
            }
          },
          'image/jpeg',
          0.9 // Calidad del 90%
        );
      };
      
      img.onerror = () => reject(new Error('Error al cargar imagen'));
    };
    
    reader.onerror = () => reject(new Error('Error al leer archivo'));
  });
}

