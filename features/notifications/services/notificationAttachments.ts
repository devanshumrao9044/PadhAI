import * as ImageManipulator from 'expo-image-manipulator';
import {
  formatAttachmentSize,
  NOTIFICATION_MAX_IMAGE_DIMENSION,
  NOTIFICATION_MAX_IMAGE_OUTPUT_BYTES,
  NOTIFICATION_MAX_PDF_BYTES,
  NOTIFICATION_MAX_SOURCE_BYTES,
  type NotificationFileAsset,
  validateNotificationImageAsset,
  validateNotificationPdfAsset,
} from './notificationAttachmentsPolicy.ts';

export {
  NOTIFICATION_MAX_IMAGE_DIMENSION,
  NOTIFICATION_MAX_IMAGE_OUTPUT_BYTES,
  NOTIFICATION_MAX_PDF_BYTES,
  NOTIFICATION_MAX_SOURCE_BYTES,
} from './notificationAttachmentsPolicy.ts';

const IMAGE_QUALITY_ATTEMPTS = [0.82, 0.72, 0.62, 0.52, 0.42];

export type PreparedNotificationAttachment = {
  body: ArrayBuffer;
  mimeType: 'image/jpeg' | 'application/pdf';
  sizeBytes: number;
  extension: 'jpg' | 'pdf';
  displayName: string;
};

type FileAsset = NotificationFileAsset;

async function readUri(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Unable to read the selected attachment.');
  return response.arrayBuffer();
}

export async function prepareNotificationImage(asset: FileAsset): Promise<PreparedNotificationAttachment> {
  validateNotificationImageAsset(asset);
  let lastSize = 0;
  for (const quality of IMAGE_QUALITY_ATTEMPTS) {
    const result = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: NOTIFICATION_MAX_IMAGE_DIMENSION } }],
      { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64: false },
    );
    const body = await readUri(result.uri);
    lastSize = body.byteLength;
    if (lastSize <= NOTIFICATION_MAX_IMAGE_OUTPUT_BYTES) {
      return {
        body,
        mimeType: 'image/jpeg',
        sizeBytes: lastSize,
        extension: 'jpg',
        displayName: `${(asset.fileName ?? asset.name ?? 'notification-image').replace(/\.[^.]+$/, '')}.jpg`,
      };
    }
  }
  throw new Error(`The compressed image is still ${Math.ceil(lastSize / 1024)} KB. Choose a simpler image.`);
}

export async function prepareNotificationPdf(asset: FileAsset): Promise<PreparedNotificationAttachment> {
  validateNotificationPdfAsset(asset);
  const body = await readUri(asset.uri);
  if (body.byteLength < 1 || body.byteLength > NOTIFICATION_MAX_PDF_BYTES) {
    throw new Error(`PDF must be smaller than ${formatAttachmentSize(NOTIFICATION_MAX_PDF_BYTES)}.`);
  }
  return {
    body,
    mimeType: 'application/pdf',
    sizeBytes: body.byteLength,
    extension: 'pdf',
    displayName: asset.fileName ?? asset.name ?? 'notification-document.pdf',
  };
}
