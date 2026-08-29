import { FileValidator } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';

// Raster images only. SVG is deliberately excluded: it is executable markup
// and a stored-XSS vector the moment a browser renders it from our origin, so
// a "logo" is never allowed to be one.
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg']);

/**
 * Validates the uploaded logo's real content (magic numbers), not the
 * client-supplied Content-Type header, which is trivially spoofable.
 *
 * Mirrors ResumeFileTypeValidator: a purely content-based check that also
 * normalizes file.mimetype to the detected type, so downstream code that
 * derives the storage extension and stored Content-Type trusts real bytes,
 * not the client-supplied header.
 */
export class LogoFileTypeValidator extends FileValidator<
  Record<string, never>,
  Express.Multer.File
> {
  constructor() {
    super({});
  }

  async isValid(file?: Express.Multer.File): Promise<boolean> {
    if (!file?.buffer) return false;

    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) return false;

    // Override the spoofable client header with the magic-number-detected
    // value, mirroring Nest's built-in FileTypeValidator `overrideMimeType`.
    file.mimetype = detected.mime;
    return true;
  }

  buildErrorMessage(): string {
    return 'Logo must be a PNG or JPEG image.';
  }
}
