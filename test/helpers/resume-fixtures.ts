import { crc32 } from 'zlib';

function u16(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  return b;
}

function u32(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n, 0);
  return b;
}

/** A minimal but magic-number-valid PDF, detected as application/pdf. */
export const PDF_BUFFER = Buffer.from(
  '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n1 0 obj\n<< >>\nendobj\ntrailer\n<< >>\n%%EOF',
  'binary',
);

/**
 * A minimal legacy .doc: just the OLE Compound File Binary signature
 * (`file-type` can't distinguish .doc from .xls/.ppt by magic bytes alone,
 * so this is all its detector needs — the filename extension carries the
 * rest of the signal, matching ResumeFileTypeValidator).
 */
export const LEGACY_DOC_BUFFER = Buffer.concat([
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  Buffer.alloc(512),
]);

/** A real (but disallowed) file type, for the "wrong file type" test. */
export const JPEG_BUFFER = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

/**
 * Builds a minimal single-entry, uncompressed ZIP containing a
 * `[Content_Types].xml` with the Open XML wordprocessingml content-type
 * declaration that `file-type`'s docx detector looks for — enough to be
 * detected as a real .docx without needing a full Word-generated file.
 */
export function buildMinimalDocx(): Buffer {
  const filename = Buffer.from('[Content_Types].xml', 'utf8');
  const content = Buffer.from(
    '<?xml version="1.0"?><Types><Override PartName="/word/document.xml" ' +
      'ContentType="application/vnd.openxmlformats-officedocument.' +
      'wordprocessingml.document.main+xml"/></Types>',
    'utf8',
  );
  const crc = crc32(content) >>> 0;

  const localHeader = Buffer.concat([
    u32(0x04034b50),
    u16(20), // version needed to extract
    u16(0), // general purpose flag
    u16(0), // compression method: stored
    u16(0), // last mod file time
    u16(0), // last mod file date
    u32(crc),
    u32(content.length), // compressed size (== uncompressed, stored)
    u32(content.length),
    u16(filename.length),
    u16(0), // extra field length
    filename,
  ]);
  const localEntry = Buffer.concat([localHeader, content]);

  const centralHeader = Buffer.concat([
    u32(0x02014b50),
    u16(20), // version made by
    u16(20), // version needed to extract
    u16(0), // general purpose flag
    u16(0), // compression method
    u16(0), // last mod file time
    u16(0), // last mod file date
    u32(crc),
    u32(content.length),
    u32(content.length),
    u16(filename.length),
    u16(0), // extra field length
    u16(0), // file comment length
    u16(0), // disk number start
    u16(0), // internal file attributes
    u32(0), // external file attributes
    u32(0), // relative offset of local header
    filename,
  ]);

  const endOfCentralDirectory = Buffer.concat([
    u32(0x06054b50),
    u16(0), // number of this disk
    u16(0), // disk where central directory starts
    u16(1), // central directory records on this disk
    u16(1), // total central directory records
    u32(centralHeader.length),
    u32(localEntry.length), // offset of start of central directory
    u16(0), // comment length
  ]);

  return Buffer.concat([localEntry, centralHeader, endOfCentralDirectory]);
}
