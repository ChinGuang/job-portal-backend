// Paging defaults shared by every listing feed — the employer's own listings,
// the public job board, and a seeker's own applications — so that no two feeds
// answer the same question with different page sizes.
export const ListPaging = {
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;
