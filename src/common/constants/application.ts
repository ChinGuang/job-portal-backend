// Bounds on what a job seeker may send when applying. Like JobLimit, these are
// sanity bounds rather than business rules: they keep absurd payloads out of
// the database and say nothing about what makes a good application.
export const ApplicationLimit = {
  COVER_LETTER_MAX_LENGTH: 10000,
  // The résumé snapshot is a private-bucket object key, not prose, so the
  // bound only needs to be generous enough for any key storage produces.
  RESUME_URL_MAX_LENGTH: 1024,
} as const;

// Paging for the seeker's own application feed.
//
// Kept separate from JobListPaging rather than shared with it: the two feeds
// answer different questions, and one changing its page size should not
// silently move the other.
export const ApplicationListPaging = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;
