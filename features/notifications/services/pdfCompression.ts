import { PDFDocument } from 'pdf-lib';

export async function compressPdfBytes(body: ArrayBuffer): Promise<ArrayBuffer> {
  const sourcePdf = await PDFDocument.load(body, { updateMetadata: false });
  const compressedBytes = await sourcePdf.save({
    useObjectStreams: true,
    addDefaultPage: false,
    updateFieldAppearances: false,
  });
  return new Uint8Array(compressedBytes).buffer;
}

export function chooseSmallerPdf(originalBody: ArrayBuffer, compressedBody: ArrayBuffer): ArrayBuffer {
  return compressedBody.byteLength < originalBody.byteLength ? compressedBody : originalBody;
}
