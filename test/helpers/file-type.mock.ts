/**
 * Manual mock for the ESM-only `file-type` package, wired in for every e2e
 * test via jest-e2e.json's moduleNameMapper (ts-jest can't statically
 * transform file-type's own ESM dependency chain). `file-type` is a
 * genuinely external, third-party content-sniffing library — faked here the
 * same way jwks-rsa and the storage service are faked elsewhere in this
 * suite, rather than loading the real package into every e2e run for a
 * dependency the tests don't need to exercise for real.
 *
 * Mirrors real magic-number detection closely enough for the fixtures used
 * by test/helpers/resume-fixtures.ts.
 */
export function fileTypeFromBuffer(
  buffer: Buffer,
): Promise<{ ext: string; mime: string } | undefined> {
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') {
    return Promise.resolve({ ext: 'pdf', mime: 'application/pdf' });
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0
  ) {
    return Promise.resolve({ ext: 'cfb', mime: 'application/x-cfb' });
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer.includes(Buffer.from('wordprocessingml'))
  ) {
    return Promise.resolve({
      ext: 'docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return Promise.resolve({ ext: 'jpg', mime: 'image/jpeg' });
  }

  return Promise.resolve(undefined);
}
