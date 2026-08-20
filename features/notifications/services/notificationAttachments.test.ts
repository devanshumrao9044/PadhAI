import assert from 'node:assert/strict';
import test from 'node:test';
import {
  NOTIFICATION_MAX_PDF_BYTES,
  NOTIFICATION_MAX_SOURCE_BYTES,
  validateNotificationImageAsset,
  validateNotificationPdfAsset,
} from './notificationAttachmentsPolicy.ts';

test('notification attachments keep the source image limit bounded before compression', () => {
  assert.throws(
    () => validateNotificationImageAsset({
      uri: 'file:///too-large.jpg',
      mimeType: 'image/jpeg',
      fileSize: NOTIFICATION_MAX_SOURCE_BYTES + 1,
    }),
    /before compression/i,
  );
});

test('notification image preparation rejects non-image MIME types', () => {
  assert.throws(
    () => validateNotificationImageAsset({
      uri: 'file:///document.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
    }),
    /image file/i,
  );
});

test('notification PDF preparation rejects non-PDF MIME types', () => {
  assert.throws(
    () => validateNotificationPdfAsset({
      uri: 'file:///photo.jpg',
      mimeType: 'image/jpeg',
      fileSize: 1024,
    }),
    /PDF file/i,
  );
});

test('notification PDF preparation rejects files above the 3 MiB limit before reading them', () => {
  assert.throws(
    () => validateNotificationPdfAsset({
      uri: 'file:///large.pdf',
      mimeType: 'application/pdf',
      fileSize: NOTIFICATION_MAX_PDF_BYTES + 1,
    }),
    /3\.0 MB/i,
  );
});
