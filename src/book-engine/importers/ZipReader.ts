/**
 * Lightweight Client-Side ZIP Reader for EPUB & DOCX
 * Zero external dependencies, pure ArrayBuffer / DataView extraction.
 */

export class ZipReader {
  public static async unzip(buffer: ArrayBuffer): Promise<Record<string, Uint8Array>> {
    const files: Record<string, Uint8Array> = {};
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    let offset = 0;
    const length = buffer.byteLength;

    // Search for Local File Headers (0x04034b50)
    while (offset < length - 30) {
      const signature = view.getUint32(offset, true);
      if (signature !== 0x04034b50) {
        // End of central directory or other record, advance
        offset++;
        continue;
      }

      const compressionMethod = view.getUint16(offset + 8, true);
      const compressedSize = view.getUint32(offset + 18, true);
      const uncompressedSize = view.getUint32(offset + 22, true);
      const fileNameLength = view.getUint16(offset + 26, true);
      const extraFieldLength = view.getUint16(offset + 28, true);

      const fileNameBytes = bytes.slice(offset + 30, offset + 30 + fileNameLength);
      const fileName = new TextDecoder('utf-8').decode(fileNameBytes);

      const dataOffset = offset + 30 + fileNameLength + extraFieldLength;
      const compressedData = bytes.slice(dataOffset, dataOffset + compressedSize);

      if (compressionMethod === 0) {
        // Stored (no compression)
        files[fileName] = compressedData;
      } else if (compressionMethod === 8) {
        // Deflate compression: use browser native DecompressionStream if available
        try {
          if (typeof DecompressionStream !== 'undefined') {
            const ds = new DecompressionStream('deflate-raw');
            const writer = ds.writable.getWriter();
            writer.write(compressedData);
            writer.close();
            const response = new Response(ds.readable);
            const decompressedBuffer = await response.arrayBuffer();
            files[fileName] = new Uint8Array(decompressedBuffer);
          } else {
            files[fileName] = compressedData;
          }
        } catch {
          files[fileName] = compressedData;
        }
      }

      offset = dataOffset + compressedSize;
    }

    return files;
  }
}
