import * as ImageManipulator from 'expo-image-manipulator';
import { chooseSmallerPdf, compressPdfBytes } from './pdfCompression.ts';
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
  NOTIFICATION_MAX_PDF_SOURCE_BYTES,
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
  const originalBody = await readUri(asset.uri);
  if (originalBody.byteLength < 1) {
    throw new Error('The selected PDF is empty.');
  }

  let preparedBody = originalBody;
  try {
    const compressedBody = await compressPdfBytes(originalBody);
    preparedBody = chooseSmallerPdf(preparedBody, compressedBody);
  } catch {
    if (originalBody.byteLength > NOTIFICATION_MAX_PDF_BYTES) {
      throw new Error('This PDF could not be compressed safely. Please choose a simpler PDF under 3.0 MB.');
    }
  }

  if (preparedBody.byteLength > NOTIFICATION_MAX_PDF_BYTES) {
    throw new Error(`The compressed PDF is still ${formatAttachmentSize(preparedBody.byteLength)}. Choose a simpler PDF under ${formatAttachmentSize(NOTIFICATION_MAX_PDF_BYTES)}.`);
  }

  return {
    body: preparedBody,
    mimeType: 'application/pdf',
    sizeBytes: preparedBody.byteLength,
    extension: 'pdf',
    displayName: asset.fileName ?? asset.name ?? 'notification-document.pdf',
  };
}
