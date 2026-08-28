// Résumé keys are namespaced per profile, which is what makes a key
// attributable. Both the code that writes one and the code that judges one
// handed in by a client ask here, so the layout is a single edit.

export function resumeKeyPrefix(profileId: string): string {
  return `${profileId}/`;
}

export function buildResumeKey(profileId: string, extension: string): string {
  return `${resumeKeyPrefix(profileId)}resume.${extension}`;
}

export function isOwnResumeKey(key: string, profileId: string): boolean {
  return key.startsWith(resumeKeyPrefix(profileId));
}

export const RESUME_SIGNED_URL_TTL_SECONDS = 300;
