// Bounds on job listing input. Kept generous rather than precise: they exist
// to keep absurd payloads out of the database, not to encode business rules.
//
// A plain object rather than an enum, unlike the string enums elsewhere in
// this folder: several of these bounds legitimately share a value, which a
// numeric enum forbids.
export const JobLimit = {
  TITLE_MAX_LENGTH: 255,
  DESCRIPTION_MAX_LENGTH: 10000,
  LOCATION_MAX_LENGTH: 255,
  REQUIREMENTS_MAX_COUNT: 50,
  REQUIREMENT_MAX_LENGTH: 500,
  // ISO 4217 codes are always three characters.
  CURRENCY_CODE_LENGTH: 3,
  // The API has no opinion on a currency's magnitude, so this is only an
  // upper sanity bound.
  MAX_SALARY: 1_000_000_000,
} as const;

// Paging defaults for an employer's own-listing feed.
export const JobListPaging = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;
