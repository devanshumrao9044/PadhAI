export const NOTIFICATION_MAX_SOURCE_BYTES = 8 * 1024 * 1024;
export const NOTIFICATION_MAX_PDF_SOURCE_BYTES = 12 * 1024 * 1024;
export const NOTIFICATION_MAX_PDF_BYTES = 3 * 1024 * 1024;
export const NOTIFICATION_MAX_IMAGE_OUTPUT_BYTES = 512 * 1024;
export const NOTIFICATION_MAX_IMAGE_DIMENSION = 1600;

export type NotificationFileAsset = {
  uri: string;
  fileName?: string | null;
  name?: string;
  mimeType?: string | null;
  fileSize?: number | null;
  size?: number | null;
};

export function formatAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getKnownAssetSize(asset: NotificationFileAsset): number | null {
  const size = asset.fileSize ?? asset.size;
  return typeof size === 'number' && Number.isFinite(size) && size > 0 ? size : null;
}

export function validateNotificationImageAsset(asset: NotificationFileAsset): void {
  if (asset.mimeType && !asset.mimeType.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }
  const sourceBytes = getKnownAssetSize(asset);
  if (sourceBytes && sourceBytes > NOTIFICATION_MAX_SOURCE_BYTES) {
    throw new Error(`Image must be smaller than ${formatAttachmentSize(NOTIFICATION_MAX_SOURCE_BYTES)} before compression.`);
  }
}

export function validateNotificationPdfAsset(asset: NotificationFileAsset): void {
  if (asset.mimeType && asset.mimeType !== 'application/pdf') {
    throw new Error('Please choose a PDF file.');
  }
  const sourceBytes = getKnownAssetSize(asset);
  if (sourceBytes && sourceBytes > NOTIFICATION_MAX_PDF_SOURCE_BYTES) {
    throw new Error(`PDF must be smaller than ${formatAttachmentSize(NOTIFICATION_MAX_PDF_SOURCE_BYTES)} before compression.`);
  }
}

export function getNotificationAttachmentLimit(mimeType: 'image/jpeg' | 'application/pdf'): number {
  return mimeType === 'image/jpeg' ? NOTIFICATION_MAX_IMAGE_OUTPUT_BYTES : NOTIFICATION_MAX_PDF_BYTES;
}
