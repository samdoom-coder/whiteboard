export interface ImageInfo {
  dataURL: string;
  width: number;
  height: number;
}

export const readFileToImage = (file: File): Promise<ImageInfo> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataURL = reader.result as string;
      const img = new Image();
      img.onload = () => resolve({ dataURL, width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("Invalid image"));
      img.src = dataURL;
    };
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });