/**
 * Where a job seeker's résumés live in the bucket, and the single place that
 * layout is decided.
 *
 * Résumé keys are namespaced per profile. That prefix is what makes a key
 * attributable: anything under it belongs to that seeker and nothing else
 * does. Both the code that writes a key and the code that has to judge a key
 * handed in by a client ask here, so the convention cannot drift apart across
 * modules — changing the layout is one edit, not a hunt.
 */

/** The prefix every one of a profile's résumé objects sits under. */
export function resumeKeyPrefix(profileId: string): string {
  return `${profileId}/`;
}

/** The key a freshly uploaded résumé is stored at. */
export function buildResumeKey(profileId: string, extension: string): string {
  return `${resumeKeyPrefix(profileId)}resume.${extension}`;
}

/**
 * Whether `key` names an object inside this profile's namespace.
 *
 * The guard against a client naming someone else's private object: a résumé
 * key is stored as a plain string and later exchanged for a signed URL, so an
 * unchecked one would be a way to attach another seeker's file to your own
 * application.
 */
export function isOwnResumeKey(key: string, profileId: string): boolean {
  return key.startsWith(resumeKeyPrefix(profileId));
}
