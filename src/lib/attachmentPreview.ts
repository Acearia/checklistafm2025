export interface AttachmentLike {
  name?: string | null;
  type?: string | null;
  data_url?: string | null;
  dataUrl?: string | null;
  url?: string | null;
  preview_url?: string | null;
}

const IMAGE_EXTENSION_REGEX = /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i;
const DEFAULT_IMAGE_MAX_SIZE = 1024;
const DEFAULT_IMAGE_QUALITY = 0.62;

export const isImageAttachment = (file: AttachmentLike) => {
  const mimeType = String(file?.type || "").toLowerCase();
  if (mimeType.startsWith("image/")) return true;
  const fileName = String(file?.name || "");
  return IMAGE_EXTENSION_REGEX.test(fileName);
};

export const resolveAttachmentPreviewUrl = (file: AttachmentLike) =>
  String(file?.data_url || file?.dataUrl || file?.preview_url || file?.url || "").trim();

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });

const resizeImageToDataUrl = (file: File, maxSize: number, quality: number): Promise<string> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      const ratio = Math.min(maxSize / image.width, maxSize / image.height, 1);
      const width = Math.max(1, Math.round(image.width * ratio));
      const height = Math.max(1, Math.round(image.height * ratio));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Falha ao processar imagem."));
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            reject(new Error("Falha ao gerar miniatura."));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Falha ao ler miniatura."));
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        quality,
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Falha ao carregar imagem."));
    };

    image.src = objectUrl;
  });

export const buildImagePreviewDataUrl = async (
  file: File,
  options?: {
    maxSize?: number;
    quality?: number;
  },
) => {
  if (!isImageAttachment(file)) return "";

  const maxSize = options?.maxSize ?? DEFAULT_IMAGE_MAX_SIZE;
  const quality = options?.quality ?? DEFAULT_IMAGE_QUALITY;

  try {
    return await resizeImageToDataUrl(file, maxSize, quality);
  } catch {
    return readFileAsDataUrl(file);
  }
};

export const estimateDataUrlBytes = (dataUrl: string) => {
  const base64 = String(dataUrl || "").split(",")[1] || "";
  if (!base64) return 0;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
};

export const buildCompressedImageAttachment = async (
  file: File,
  options?: {
    maxSize?: number;
    quality?: number;
  },
) => {
  const dataUrl = isImageAttachment(file)
    ? await buildImagePreviewDataUrl(file, options)
    : await readFileAsDataUrl(file);
  const compressedSize = estimateDataUrlBytes(dataUrl);

  return {
    name: file.name,
    size: compressedSize || file.size,
    type: isImageAttachment(file) ? "image/jpeg" : file.type,
    data_url: dataUrl,
  };
};
