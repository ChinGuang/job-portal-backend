// Shared by every listing feed, so no two answer the same question with
// different page sizes.
export const ListPaging = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;
