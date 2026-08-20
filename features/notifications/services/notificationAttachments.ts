import * as ImageManipulator from 'expo-image-manipulator';
export const NOTIFICATION_MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const NOTIFICATION_MAX_IMAGE_OUTPUT_BYTES = 512 * 1024;
export const NOTIFICATION_MAX_IMAGE_DIMENSION = 1600;

const IMAGE_QUALITY_ATTEMPTS = [0.82, 0.72, 0.62, 0.52, 0.42];

export type PreparedNotificationAttachment = {
  body: ArrayBuffer;
  mimeType: 'image/jpeg' | 'application/pdf';
  sizeBytes: number;
  extension: 'jpg' | 'pdf';
  displayName: string;
};

type FileAsset = {
  uri: string;
  fileName?: string | null;
  name?: string;
  mimeType?: string | null;
};

async function readUri(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Unable to read the selected attachment.');
  return response.arrayBuffer();
}

export async function prepareNotificationImage(asset: FileAsset): Promise<PreparedNotificationAttachment> {
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
        displayName: asset.fileName ?? asset.name ?? 'notification-image.jpg',
      };
    }
  }
  throw new Error(`The compressed image is still ${Math.ceil(lastSize / 1024)} KB. Choose a simpler image.`);
}

export async function prepareNotificationPdf(asset: FileAsset): Promise<PreparedNotificationAttachment> {
  const body = await readUri(asset.uri);
  if (body.byteLength < 1 || body.byteLength > NOTIFICATION_MAX_ATTACHMENT_BYTES) {
    throw new Error(`PDF must be smaller than ${Math.floor(NOTIFICATION_MAX_ATTACHMENT_BYTES / (1024 * 1024))} MB.`);
  }
  return {
    body,
    mimeType: 'application/pdf',
    sizeBytes: body.byteLength,
    extension: 'pdf',
    displayName: asset.fileName ?? asset.name ?? 'notification-document.pdf',
  };
}
