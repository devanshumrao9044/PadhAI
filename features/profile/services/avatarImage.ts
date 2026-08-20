import * as ImageManipulator from 'expo-image-manipulator';
import {
  AVATAR_MAX_DIMENSION,
  MAX_AVATAR_OUTPUT_BYTES,
  MAX_AVATAR_SOURCE_BYTES,
  AVATAR_SUPPORTED_INPUT_FORMATS,
  formatFileSize,
} from './avatarPolicy.ts';

export {
  AVATAR_MAX_DIMENSION,
  MAX_AVATAR_OUTPUT_BYTES,
  MAX_AVATAR_SOURCE_BYTES,
  AVATAR_SUPPORTED_INPUT_FORMATS,
  formatFileSize,
} from './avatarPolicy.ts';

const JPEG_QUALITY_ATTEMPTS = [0.78, 0.68, 0.58, 0.48, 0.38];

type ImageAssetLike = {
  uri: string;
  fileSize?: number | null;
  file?: { size?: number } | null;
};

export async function getImageByteSize(asset: ImageAssetLike): Promise<number> {
  const knownSize = asset.fileSize ?? asset.file?.size;
  if (typeof knownSize === 'number' && Number.isFinite(knownSize) && knownSize > 0) {
    return knownSize;
  }

  const response = await fetch(asset.uri);
  if (!response.ok) throw new Error('Unable to read the selected image.');
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > 0) return contentLength;
  const body = await response.arrayBuffer();
  return body.byteLength;
}

export async function prepareAvatarImage(uri: string): Promise<{ body: ArrayBuffer; bytes: number }> {
  let lastBytes = 0;

  for (const quality of JPEG_QUALITY_ATTEMPTS) {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: AVATAR_MAX_DIMENSION } }],
      {
        compress: quality,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: false,
      },
    );
    const response = await fetch(result.uri);
    if (!response.ok) throw new Error('Unable to read the compressed image.');
    const body = await response.arrayBuffer();
    lastBytes = body.byteLength;
    if (lastBytes <= MAX_AVATAR_OUTPUT_BYTES) return { body, bytes: lastBytes };
  }

  throw new Error(
    `The compressed photo is still ${formatFileSize(lastBytes)}. Please choose a simpler image.`,
  );
}
