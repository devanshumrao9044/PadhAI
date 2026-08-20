import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { chooseSmallerPdf, compressPdfBytes } from './pdfCompression.ts';

test('PDF compression preserves a readable document and never selects a larger payload', async () => {
  const sourcePdf = await PDFDocument.create();
  sourcePdf.addPage([612, 792]);
  const originalBody = new Uint8Array(await sourcePdf.save()).buffer;
  const compressedBody = await compressPdfBytes(originalBody);
  const selectedBody = chooseSmallerPdf(originalBody, compressedBody);
  const readablePdf = await PDFDocument.load(selectedBody);

  assert.equal(readablePdf.getPageCount(), 1);
  assert.ok(selectedBody.byteLength <= originalBody.byteLength);
});
