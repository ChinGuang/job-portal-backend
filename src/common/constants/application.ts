// Sanity bounds, like JobLimit: they keep absurd payloads out of the database
// and say nothing about what makes a good application.
export const ApplicationLimit = {
  COVER_LETTER_MAX_LENGTH: 10000,
  RESUME_URL_MAX_LENGTH: 1024,
} as const;
