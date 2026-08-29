/** A minimal but magic-number-valid PNG, detected as image/png. */
export const PNG_BUFFER = Buffer.concat([
  // 8-byte PNG signature
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  // Enough trailing bytes to look like a real (tiny) file, contents irrelevant
  // to the magic-number detector.
  Buffer.alloc(16),
]);

/**
 * A plain SVG document. It has no magic number (it is XML text), so `file-type`
 * cannot identify it — which is exactly why the logo validator rejects it: an
 * SVG is executable markup and never an allowed logo.
 */
export const SVG_BUFFER = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>',
  'utf8',
);
