import { FileValidator } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
]);

// Legacy .doc is a generic Compound File Binary container — file-type's
// magic-number detection can't distinguish it from .xls/.ppt by content
// alone (that needs a full OLE parser, which is out of scope here), so the
// filename extension is the only additional signal available for this one
// format.
const LEGACY_DOC_CONTAINER_MIME_TYPE = 'application/x-cfb';

/**
 * Validates the uploaded résumé's real content (magic numbers), not the
 * client-supplied Content-Type header, which is trivially spoofable.
 */
export class ResumeFileTypeValidator extends FileValidator<
  Record<string, never>,
  Express.Multer.File
> {
  constructor() {
    super({});
  }

  async isValid(file?: Express.Multer.File): Promise<boolean> {
    if (!file?.buffer) return false;

    const detected = await fileTypeFromBuffer(file.buffer);
    if (!detected) return false;

    const isAllowed =
      ALLOWED_MIME_TYPES.has(detected.mime) ||
      (detected.mime === LEGACY_DOC_CONTAINER_MIME_TYPE &&
        file.originalname.toLowerCase().endsWith('.doc'));
    if (!isAllowed) return false;

    // Downstream code (JobSeekerProfileService.uploadResume) derives the
    // storage extension/content-type from file.mimetype — overriding it
    // with the magic-number-detected value here (mirroring Nest's own
    // built-in FileTypeValidator's `overrideMimeType` option) means it
    // trusts real content, not the client-supplied, spoofable header.
    //
    // A legacy .doc is detected only as the generic OLE container
    // (application/x-cfb); normalize it to the real document type so the
    // object is stored and later served with a Content-Type clients recognize
    // as a Word document, not an opaque binary blob.
    file.mimetype =
      detected.mime === LEGACY_DOC_CONTAINER_MIME_TYPE
        ? 'application/msword'
        : detected.mime;
    return true;
  }

  buildErrorMessage(): string {
    return 'Résumé must be a PDF, DOC, or DOCX file.';
  }
}
