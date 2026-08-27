import { JobStatus } from '../entities/job.entity';

// The lifecycle a listing may walk, as the moves available from each status.
// What each status *means* — which are publicly visible, which accept
// applications — is documented on `JobStatus` itself.
//
// Only the two transitions the lifecycle names are reachable through the
// status endpoint: a draft is published, and a published listing is closed.
// Everything else is absent on purpose:
//   - Nothing returns to DRAFT. A published listing has already been seen by
//     the public, and calling it a draft again would misdescribe it.
//   - CLOSED does not reopen. Reopening is not part of v1, and a fresh listing
//     says something truthful to candidates that a resurrected one does not.
//   - ARCHIVED is not reachable here at all: archiving is what DELETE means,
//     and one operation deserves exactly one door.
//   - ARCHIVED has no exits. It is where a listing's life ends.
const ALLOWED_TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  [JobStatus.DRAFT]: [JobStatus.PUBLISHED],
  [JobStatus.PUBLISHED]: [JobStatus.CLOSED],
  [JobStatus.CLOSED]: [],
  [JobStatus.ARCHIVED]: [],
};

/**
 * Whether a listing may move from `from` to `to` through the status endpoint.
 *
 * A status is never a legal move to itself: a no-op transition means the
 * caller has lost track of the listing, and saying so is more useful than
 * silently succeeding.
 */
export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * Whether a listing has reached the end of its life. An archived listing is
 * a record of something that happened, so nothing may edit or move it.
 */
export function isTerminal(status: JobStatus): boolean {
  return status === JobStatus.ARCHIVED;
}
