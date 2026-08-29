// Logo keys are namespaced per employer profile, which is what makes a key
// attributable. The key layout and the mime-to-extension mapping that drives
// it live together here, so adding a supported format is a single edit.
//
// Logos share the private résumé bucket, so the `logos/` prefix keeps them in
// a namespace that can never collide with the résumé layout
// (`{profileId}/resume.{ext}`).

const LOGO_EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
};

export function buildLogoKey(
  employerProfileId: string,
  mimeType: string,
): string {
  const extension = LOGO_EXTENSION_BY_MIME_TYPE[mimeType];
  if (!extension) {
    // Unreachable in practice: LogoFileTypeValidator only admits the mime
    // types mapped above and normalizes file.mimetype to the detected one. A
    // miss here means that invariant was broken upstream, not a client input
    // to absorb — so fail loudly rather than inventing an extension.
    throw new Error(`Unsupported logo mime type: ${mimeType}`);
  }
  return `logos/${employerProfileId}/logo.${extension}`;
}

// A logo is far less sensitive than a résumé and is fetched on every render of
// a company's listing, so its signed URL lives longer than the résumé's 300s —
// comfortably past any single page's render lifetime.
export const LOGO_SIGNED_URL_TTL_SECONDS = 3600;
